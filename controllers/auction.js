const socket = require('../socket')
const Account = require('../models/account')
const Team = require('../models/team')
const Player = require('../models/player')
const Bid = require('../models/bid')

const {
  initializeStore,
  getStore,
  updateStore,
} = require('../database/localdb')
const {
  DEFAULT_BID_AMOUNT,
  BID_INCREASE,
  AUCTION_INTERVAL_IN_SEC,
} = require('../constants')

// AUCTION_SCHEMA : {
//   state: (null/'ready'/'progress'/'completed'/)
//   accountId: null,
//   teams: [<teamId>],
//   budget: {teamId: <budget>}
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
//     {playerId : <playerId>, teamId: <teamId>, amount: <amount>, timestamp: <timestamp> }
//   ]
// }

let auctionTimer
let cnt_interval_iterations = 0
const MAX_INTERVAL_ITERATIONS = 1000

const STORE_INITIAL_STATE = {
  state: null,
  accountId: null,
  teams: [],
  budget: {},
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

const saveAuction = async () => {
  const store = await getStore()
  await Account.findByIdAndUpdate(store.accountId, { isAuctioned: true })
  await Bid.insertMany(store.bids.map((bid, i) => ({ ...bid, index: i })))
  for (let playerId of store.soldPlayers) {
    const lastBidId = store.playerLastBid[playerId]
    const lastBid = store.bids[lastBidId]
    const { teamId, timestamp } = lastBid
    const player = await Player.findById(playerId)
    player.teamId = teamId
    player.lastBid = await Bid.findOne({ timestamp })
    await player.save()
  }
  console.log('---------auction-saved-----------')
}

const updateAuctionState = () => {
  getStore()
    .then((store) => {
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
          // push the player to sold
          store.soldPlayers.push(store.currentPlayer.id)
          const playerId = store.currentPlayer.id
          const playerBids = store.currentPlayer.bids
          const lastBidId = playerBids[playerBids.length - 1]
          const lastBidData = store.bids[lastBidId]
          // udpate the player-last-bid and budget of the corresponding team
          store.playerLastBid[playerId] = lastBidId
          store.budget[lastBidData.teamId] -= lastBidData.amount
          // remove the player from current
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
            return updateStore(store).then((store) => {
              console.log('----final-store', store)
              saveAuction()
              refreshClients('auction-ended', store)
            })
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
      return updateStore(store).then((store) => {
        // send event to clients
        refreshClients('timer-updated', store)
      })
    })
    .catch((err) => {
      if (err) {
        clearInterval(auctionTimer)
        console.log('Error while updating auction-state', err)
      }
    })
}

const resetAuctionTimer = () => {
  clearInterval(auctionTimer)
  auctionTimer = setInterval(() => {
    // handling infinite loops of iterations
    if (cnt_interval_iterations > MAX_INTERVAL_ITERATIONS) {
      clearInterval(auctionTimer)
      return
    }
    updateAuctionState()
  }, 1000)
}

const startAuction = () => {
  // clearing the previous interval if present
  clearInterval(auctionTimer)
  // fetch store and ready first player for auction
  return getStore().then((store) => {
    // start auction only when there is no player in current state and there exists some players in remaining state
    if (store.state !== 'ready') throw Error('auction state not in ready state')

    if (store.remainingPlayers.length === 0 || store.currentPlayer !== null)
      throw Error('invalid starting auction data')

    // ready first player for auction
    store.currentPlayer = {
      id: store.remainingPlayers[0],
      bidAmount: DEFAULT_BID_AMOUNT,
      bids: [],
      clock: AUCTION_INTERVAL_IN_SEC,
    }
    store.remainingPlayers.shift()
    store.state = 'progress'
    // update store and start auction timer
    return updateStore(store).then((store) => {
      // refresh clients
      refreshClients('auction-started', store)
      // set interval
      auctionTimer = setInterval(() => {
        // handling infinite loops of interval
        if (cnt_interval_iterations > MAX_INTERVAL_ITERATIONS) {
          clearInterval(auctionTimer)
          return
        }
        updateAuctionState()
      }, 1000)
    })
  })
}

module.exports.startAuction = async (req, res, next) => {
  try {
    const { accountId } = req.body
    // check accountid is provided
    if (!accountId) {
      return res.status(400).json({
        status: 'error',
        msg: 'Account not provided for auction',
      })
    }
    // check account exists
    const account = Account.find(accountId)
    if (!account)
      return res.status(400).json({
        status: 'error',
        msg: 'Given account not exist',
      })
    // check teams exist under account
    const teams = await Team.find({ accountId: accountId }).lean()
    const budget = {}
    if (teams.length === 0) {
      return res.status(400).json({
        status: 'error',
        msg: 'No team is present for given account',
      })
    }
    // check all the teams have team owner set
    const teamOwners = []
    for (let team of teams) {
      if (!team.teamOwner)
        return res.status(400).json({
          status: 'error',
          msg: 'team owner is not set for all the teams under the account',
        })
      // set teamowners and budget for each team of given account
      teamOwners.push(team.teamOwner.playerId.toString())
      budget[team._id.toString()] = team.teamOwner.budget
    }
    // check players exist under account excluding team owners
    let players = await Player.find({ accountId: accountId }).lean()
    players = players.filter(
      (player) => !teamOwners.includes(player._id.toString())
    )
    if (players.length === 0) {
      return res.status(400).json({
        status: 'error',
        msg: 'No player is present for auction for given account',
      })
    }
    // check state of auction should be null or undefined
    let store = await getStore()
    if (store.state) {
      return res.status(400).json({
        status: 'error',
        msg: 'Auction not in null state, reset the auction',
      })
    }
    // initialize local database for auction process
    store = await initializeStore({
      ...STORE_INITIAL_STATE,
      state: 'ready',
      accountId: accountId,
      teams: teams.map((team) => team._id.toString()),
      budget,
      remainingPlayers: players.map((player) => player._id.toString()),
    })
    // start the auction process and send response to client
    await startAuction()
    return res.status(200).json({
      status: 'ok',
      msg: 'auction started for ' + account.name,
      data: store,
    })
  } catch (err) {
    next(err)
  }
}

module.exports.pauseAuction = (req, res, next) => {
  clearInterval(auctionTimer)
  return res.status(200).json({
    status: 'ok',
    msg: 'auction paused',
  })
}

module.exports.resetAuction = (req, res, next) => {
  clearInterval(auctionTimer)
  initializeStore(STORE_INITIAL_STATE)
    .then((store) => {
      return res.status(200).json({
        status: 'ok',
        msg: 'auction reset completed',
        data: store,
      })
    })
    .catch((err) => {
      next(err)
    })
}

module.exports.postBid = (req, res, next) => {
  const { playerId, teamId, amount } = req.body
  const bidAmount = +amount
  if (!playerId || !teamId || !amount) {
    return res.status(400).json({
      status: 'error',
      msg: 'insufficient payload for bid',
    })
  }
  getStore()
    .then((store) => {
      // check team access to current auction
      if (!store.teams.includes(teamId)) {
        return res.status(400).json({
          status: 'error',
          msg: 'team does not have access to current auction',
        })
      }
      // check auction is in progres and match current player-id
      if (!store.currentPlayer || playerId !== store.currentPlayer.id) {
        return res.status(400).json({
          status: 'error',
          msg: 'player not present for auction, refresh and check again',
        })
      }
      // check validity of next bid-amount to be placed
      if (isNaN(bidAmount) || bidAmount < store.currentPlayer.bidAmount) {
        return res.status(400).json({
          status: 'error',
          msg: 'bid amount not valid',
        })
      }
      // check team has enough budget
      if (bidAmount > store.budget[teamId]) {
        return res.status(400).json({
          status: 'error',
          msg: 'team does not have enough budget',
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
        'currentPlayer.bidAmount': bidAmount + BID_INCREASE,
        'currentPlayer.clock': AUCTION_INTERVAL_IN_SEC,
        bids: [
          ...store.bids,
          { playerId, teamId, amount: bidAmount, timestamp: Date.now() },
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
          bid: { playerId, teamId, amount: bidAmount },
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

module.exports.saveAuction = (req, res, next) => {
  saveAuction()
  return res.status(200).json({
    status: 'ok',
    msg: 'auction saved',
  })
}
