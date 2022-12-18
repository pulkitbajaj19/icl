const socket = require('../socket')
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
//   soldPlayers: [<playerId>],
//   playerLastBid: {playerId: <bidindex>},
//   currentPlayer: {
//     id : <playerId>
//     bidAmount: <currentAmount>
//     bids : [<teamId>]
//     clock: <clock>
//   }
//   bids : [
//     {playerId : <playerId>, teamId: <teamId>, amount: <amount> }
//   ]
// }

let auctionTimer
let cnt_interval_iterations = 0

const STORE_INITIAL_STATE = {
  remainingPlayers: [],
  unsoldPlayers: [],
  soldPlayers: [],
  playerLastBid: {},
  currentPlayer: null,
  bids: [],
}

const refreshClients = (eventType, data) => {
  socket.getIo().emit('event', {
    type: eventType,
    data: data,
  })
}

const updateAuctionState = () => {
  getStore().then((store) => {
    // stop the auction process as no player is defined for auction
    if (!store.currentPlayer) {
      clearInterval(auctionTimer)
      return
    }
    // update clock for current player
    else if (store.currentPlayer.clock > 0) {
      store.currentPlayer.clock = store.currentPlayer.clock - 1
    }
    // ready next player for auction
    else {
      // if current player is bidded by some team then move it to sold state
      if (store.currentPlayer.bids.length > 0) {
        store.soldPlayers.push(store.currentPlayer.id)
        store.playerLastBid[store.currentPlayer.id] =
          store.currentPlayer.bids[store.currentPlayer.bids.length - 1]
        store.currentPlayer = null
      }
      // if no bid is made on current player then move it to unsold state
      else {
        store.unsoldPlayers.push(store.currentPlayer.id)
        store.currentPlayer = null
      }
      // if no player is remaining
      if (store.remainingPlayers.length === 0) {
        // if all players are sold then end auction
        if (store.unsoldPlayers.length === 0) {
          store.currentPlayer = null
          clearInterval(auctionTimer)
          updateStore(store).then((store) => {
            console.log('----final-store', store)
            refreshClients('auction-ended', store)
          })
          return
        }
        // if there are unsold players then ready them for next iteration
        else {
          store.remainingPlayers = store.unsoldPlayers
          store.unsoldPlayers = []
        }
      }
      // pull next player from remaining players
      if (store.remainingPlayers.length > 0) {
        store.currentPlayer = {
          id: store.remainingPlayers[0],
          bidAmount: DEFAULT_BID_AMOUNT,
          bids: [],
          clock: AUCTION_INTERVAL_IN_SEC,
        }
        store.remainingPlayers.shift()
      }
    }
    // update the store
    updateStore(store).then((store) => {
      // send event to clients
      refreshClients('timer-updated', store)
    })
  })
}

const resetAuctionTimer = () => {
  clearInterval(auctionTimer)
  auctionTimer = setInterval(() => {
    updateAuctionState()
  }, 1000)
}

const startAuction = () => {
  // clearing the previous interval if present
  clearInterval(auctionTimer)
  // fetch store and ready first player for auction
  getStore().then((store) => {
    // start auction only when there is no player in current state and there exists some players in remaining state
    if (store.remainingPlayers.length === 0 || store.currentPlayer !== null)
      throw Error('invalid starting auction state')

    // ready first player for auction
    store.currentPlayer = {
      id: store.remainingPlayers[0],
      bidAmount: DEFAULT_BID_AMOUNT,
      bids: [],
      clock: AUCTION_INTERVAL_IN_SEC,
    }
    store.remainingPlayers.shift()
    // update store and start auction timer
    updateStore(store).then((store) => {
      // refresh clients
      refreshClients('auction-started', store)
      // set interval
      auctionTimer = setInterval(() => {
        updateAuctionState()
      }, 1000)
    })
  })
}

module.exports.startAuction = (req, res, next) => {
  // initialize local database for auction process
  Player.find()
    .select('playerId')
    .lean()
    .then((players) => {
      const store = {
        ...STORE_INITIAL_STATE,
        remainingPlayers: players.map((el) => el._id.toString()),
      }
      return initializeStore(store)
    })
    .then((store) => {
      startAuction()
      return res.status(200).json({
        status: 'ok',
        msg: 'auction started',
        data: store,
      })
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
      // check if current team already bidded on the player
      const currentPlayerLastBidId =
        store.currentPlayer.bids[store.currentPlayer.bids.length - 1]
      const currentPlayerLastBidTeamId =
        currentPlayerLastBidId >= 0
          ? store.bids[currentPlayerLastBidId].teamId
          : null
      if (teamId === currentPlayerLastBidTeamId) {
        return res.status(400).json({
          status: 'error',
          msg: 'last bid is made by same team',
        })
      }
      // else create bid in the auctionState
      return updateStore({
        'currentPlayer.bids': [...store.currentPlayer.bids, store.bids.length],
        'currentPlayer.bidAmount': store.currentPlayer.bidAmount + BID_INCREASE,
        'currentPlayer.clock': AUCTION_INTERVAL_IN_SEC,
        bids: [
          ...store.bids,
          { playerId, teamId, amount: store.currentPlayer.currentAmount },
        ],
      }).then((store) => {
        // resyncing the clocks
        resetAuctionTimer()
        // updating clients
        refreshClients('bid', store)
        // returning response
        return res.status(200).json({
          status: 'ok',
          msg: 'bid made successfully',
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
