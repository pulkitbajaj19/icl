const Player = require('../models/player')
const {
  initializeStore,
  getStore,
  updateStore,
} = require('../database/localdb')
const {
  MAX_INTERVAL_ITERATIONS,
  DEFAULT_BID_AMOUNT,
  BID_INCREASE,
  AUCTION_INTERVAL_IN_SEC,
} = require('../constants')

// AUCTION_SCHEMA : {
//   remainingPlayers : [<playerId>]
//   unsoldPlayers: [<playerId>]
//   soldPlayers: [<playerId>]
//   currentPlayer: {
//     id : <playerId>
//     currentAmount: <currentAmount>
//     bids : [<teamId>]
//   }
//   bids : [
//     {playerId : <playerId>, teamId: <teamId>, amount: <amount> }
//   ]
// }
const STORE_INITIAL_STATE = {
  remainingPlayers: [],
  unsoldPlayers: [],
  soldPlayers: [],
  currentPlayer: null,
  bids: [],
}

let auctionTimer
let cnt_interval_iterations = 0

const triggerAuctionProcess = () => {
  // setting the initial interval iteration
  cnt_interval_iterations = 0
  // clearing the previous interval
  if (auctionTimer) {
    console.log('clearing previous interval')
    try {
      clearInterval(auctionTimer)
    } catch (err) {
      console.log('err while clearing timer', err)
    }
  }
  console.log('--------triggering auction')
  auctionTimer = setInterval(() => {
    // force clearing timer after MAX-ITERATIONS
    cnt_interval_iterations++
    if (cnt_interval_iterations > MAX_INTERVAL_ITERATIONS) {
      clearInterval(auctionTimer)
      return
    }

    console.log('--------------------iterating-auction')
    console.log('getting store')
    getStore().then((store) => {
      console.log('fetched-store')
      // after timeout if current player is in auction then move it to either sold or unsold
      if (store.currentPlayer) {
        if (store.currentPlayer.bids.length === 0) {
          store.unsoldPlayers.push(store.currentPlayer.id)
        } else {
          store.soldPlayers.push(store.currentPlayer.id)
        }
      }
      // if there are no remaining players and unsold players stop auction
      if (
        store.remainingPlayers.length === 0 &&
        store.unsoldPlayers.length === 0
      ) {
        store.currentPlayer = null
        console.log('Clearing timer and stopping auction')
        clearInterval(auctionTimer)
      }
      // if there are unsold players reinitialize it to unsold players
      else if (
        store.remainingPlayers.length === 0 &&
        store.unsoldPlayers.length > 0
      ) {
        store.remainingPlayers = store.unsoldPlayers
        store.unsoldPlayers = []
        console.log('reinitializing remaining players')
      }
      // if there are remaining players move the top player to auction
      if (store.remainingPlayers.length > 0) {
        // initialize next player
        store.currentPlayer = {
          id: store.remainingPlayers[0],
          bids: [],
          currentAmount: DEFAULT_BID_AMOUNT,
        }
        store.remainingPlayers.shift()
      }
      // updating the state in store
      console.log('updating-store')
      updateStore(store).then((store) => {
        console.log('store-updated ', store)
      })
    })
  }, AUCTION_INTERVAL_IN_SEC * 1000)
}

module.exports.startAuction = (req, res, next) => {
  Player.find()
    .select('playerId')
    .lean()
    .then((players) => {
      const store = {
        ...STORE_INITIAL_STATE,
        remainingPlayers: players.map((el) => el._id.toString()),
      }
      return initializeStore(store).then((store) => {
        return res.status(200).json({
          status: 'ok',
          data: store,
        })
      })
    })
    .then(() => {
      triggerAuctionProcess()
    })
    .catch((err) => {
      next(err)
    })
}

module.exports.postBid = (req, res, next) => {
  const { playerId, teamId } = req.body
  if (!playerId || !teamId) {
    return res.status(400).json({
      status: 'error',
      msg: 'insufficient payload for bid',
    })
  }
  getStore()
    .then((store) => {
      // match current player-id
      if (playerId !== store.currentPlayer.id) {
        return res.status(400).json({
          status: 'error',
          msg: 'player not present for auction, refresh and check again',
        })
      }
      return updateStore({
        'currentPlayer.bids': [...store.currentPlayer.bids, store.bids.length],
        'currentPlayer.currentAmount':
          store.currentPlayer.currentAmount + BID_INCREASE,
        bids: [
          ...store.bids,
          { playerId, teamId, amount: store.currentPlayer.currentAmount },
        ],
      }).then((store) => {
        console.log('bid-created')
        console.log('triggering auction')
        triggerAuctionProcess()
        return res.status(200).json({
          status: 'ok',
          msg: 'bid made successfully',
          data: store,
        })
      })
    })
    .catch((err) => {
      next(err)
    })
}

module.exports.getData = (req, res, next) => {
  getStore()
    .then((store) => {
      return res.status(200).json({
        status: 'ok',
        msg: 'data fetched successfully',
        data: store,
      })
    })
    .catch((err) => {
      next(err)
    })
}
