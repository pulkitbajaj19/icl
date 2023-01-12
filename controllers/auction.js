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

const eventType = {
  AUCTION_INITIALIZED: 'AUCTION_INITIALIZED',
  TIMER_UPDATED: 'TIMER_UPDATED',
  BID: 'BID',
  PLAYER_AUCTION_ENDED: 'PLAYER_AUCTION_ENDED',
  ROUND_ENDED: 'ROUND_ENDED',
  ACCOUNT_AUCTION_COMPLETED: 'ACCOUNT_AUCTION_COMPLETED',
  ACCOUNT_AUCTION_CLEARED: 'ACCOUNT_AUCTION_CLEARED',
}

// AUCTION_SCHEMA : {
//   state: (null/'ready'/'progress'/'completed'/'pause')
//   round: <roundNumber>
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
//     bids : [<bidId>]
//     clock: <clock>
//   }
//   prevPlayer: <id>
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
  round: 0,
  teams: [],
  budget: {},
  remainingPlayers: [],
  prevPlayer: null,
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

const saveCurrentPlayer = async () => {
  const store = await getStore()
  // if no player then return
  if (!store.currentPlayer) return
  const player = await Player.findById(store.currentPlayer.id)
  // if no player with the given id then return
  if (!player) return

  // if no bids then change auction state to unsold and return
  if (store.currentPlayer.bids.length === 0) {
    player.auctionStatus = 'UNSOLD'
    await player.save()
    return
  }

  // else assign the player to team
  const playerBids = []
  for (let bidIndex of store.currentPlayer.bids) {
    playerBids.push(store.bids[bidIndex])
  }
  await Bid.insertMany(playerBids)
  const lastBidIndex =
    store.currentPlayer.bids[store.currentPlayer.bids.length - 1]
  const lastBid = store.bids[lastBidIndex]
  const { teamId, timestamp } = lastBid
  player.teamId = teamId
  player.lastBid = await Bid.findOne({ timestamp })
  player.auctionStatus = 'SOLD'
  await player.save()
}

const updateAuctionState = () => {
  getStore()
    .then((store) => {
      // clear the timer and return as no player is defined for auction
      if (!store.currentPlayer) {
        clearInterval(auctionTimer)
        return
      }
      // update clock for current player
      if (store.currentPlayer.clock > 0) {
        store.currentPlayer.clock = store.currentPlayer.clock - 1
        return updateStore(store).then((store) => {
          // send event to clients
          refreshClients(eventType.TIMER_UPDATED, store)
        })
      }

      // clock is 0
      // clear timer and ready next player for auction
      clearInterval(auctionTimer)

      // save current player in database
      return saveCurrentPlayer().then(() => {
        store.prevPlayer = store.currentPlayer.id
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

        // initialize next player
        // if players are remaining
        if (store.remainingPlayers.length > 0) {
          store.currentPlayer = {
            id: store.remainingPlayers[0],
            bidAmount: DEFAULT_BID_AMOUNT,
            bids: [],
            clock: AUCTION_INTERVAL_IN_SEC,
          }
          store.remainingPlayers.shift()
          store.state = 'ready'
          return updateStore(store).then((store) => {
            refreshClients(eventType.PLAYER_AUCTION_ENDED, store)
          })
        }

        // if no player is remaining then end auction
        if (store.unsoldPlayers.length === 0) {
          store.state = 'complete'
          return updateStore(store).then((store) => {
            refreshClients(eventType.ACCOUNT_AUCTION_COMPLETED, store)
          })
        }

        // if all players are auctioned in the given round then reinitialize all unsold players
        if (store.unsoldPlayers.length > 0) {
          store.remainingPlayers = store.unsoldPlayers
          store.unsoldPlayers = []
          store.currentPlayer = {
            id: store.remainingPlayers[0],
            bidAmount: DEFAULT_BID_AMOUNT,
            bids: [],
            clock: AUCTION_INTERVAL_IN_SEC,
          }
          store.remainingPlayers.shift()
          store.state = 'ready'
          store.round += 1
          return updateStore(store).then((store) => {
            refreshClients(eventType.ROUND_ENDED, store)
          })
        }
      })
    })
    .catch((err) => {
      if (err) {
        clearInterval(auctionTimer)
        console.log('Error while updating auction-state', err)
      }
    })
}

const setAuctionInterval = () => {
  clearInterval(auctionTimer)
  auctionTimer = setInterval(() => {
    // handling infinite loops of interval
    if (cnt_interval_iterations > MAX_INTERVAL_ITERATIONS) {
      clearInterval(auctionTimer)
      return
    }
    // reset the iterations and execute logic
    cnt_interval_iterations = 0
    updateAuctionState()
  }, 1000)
}

module.exports.triggerPlayerAuction = (req, res, next) => {
  getStore()
    .then((store) => {
      if (store.state !== 'ready') {
        return res.status(500).json({
          status: 'error',
          msg: 'auction not in ready state',
        })
      }
      clearInterval(auctionTimer)
      return updateStore({ state: 'progress' }).then((store) => {
        setAuctionInterval()
        return res.status(200).json({
          status: 'ok',
          msg: 'player auction started',
          data: store,
        })
      })
    })
    .catch((err) => {
      next(err)
    })
}

module.exports.initializeAuction = async (req, res, next) => {
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
    store = {
      ...STORE_INITIAL_STATE,
      accountId: accountId,
      teams: teams.map((team) => team._id.toString()),
      budget,
      remainingPlayers: players.map((player) => player._id.toString()),
    }
    store.currentPlayer = {
      id: store.remainingPlayers[0],
      bidAmount: DEFAULT_BID_AMOUNT,
      bids: [],
      clock: AUCTION_INTERVAL_IN_SEC,
    }
    store.remainingPlayers.shift()
    store.state = 'ready'
    store = await initializeStore(store)

    await Account.findByIdAndUpdate(accountId, { isAuctioned: true })
    // refresh clients for auction started
    refreshClients(eventType.AUCTION_INITIALIZED, store)

    // start the auction process and send response to client
    return res.status(200).json({
      status: 'ok',
      msg: 'auction initialized for' + account.name,
      data: store,
    })
  } catch (err) {
    next(err)
  }
}

module.exports.pauseAuction = (req, res, next) => {
  clearInterval(auctionTimer)
  getStore()
    .then((store) => {
      if (store.state === 'progress') {
        return updateStore({ state: 'pause' }).then((store) => {
          return res.status(200).json({
            status: 'ok',
            msg: 'auction paused',
          })
        })
      }
      if (store.state === 'pause') {
        return updateStore({ state: 'progress' }).then((store) => {
          setAuctionInterval()
          return res.status(200).json({
            status: 'ok',
            msg: 'auction resumed to progress',
          })
        })
      }
      return res.status(400).json({
        status: 'ok',
        msg: 'auction pause/resume is invalid with current auction state',
      })
    })
    .catch((err) => {
      next(err)
    })
}

module.exports.endAuction = (req, res, next) => {
  getStore()
    .then((store) => {
      // check if auction in valid state to be ended
      if (
        store.state !== 'ready' &&
        store.state !== 'progress' &&
        store.state !== 'completed' &&
        store.state !== 'pause'
      )
        return res.status(400).json({
          status: 'error',
          msg: 'auction not in [ready/progress/completed/paused] state',
        })
      store.state = 'completed'
      store.currentPlayer = null
      store.remainingPlayers = []
      return updateStore(store).then((store) => {
        refreshClients(eventType.ACCOUNT_AUCTION_COMPLETED, store)
        return res.status(200).json({
          status: 'ok',
          msg: 'auction force-completed',
          store: store,
        })
      })
    })
    .catch((err) => next(err))
}

module.exports.clearAuction = (req, res, next) => {
  clearInterval(auctionTimer)
  initializeStore(STORE_INITIAL_STATE)
    .then((store) => {
      refreshClients(eventType.ACCOUNT_AUCTION_CLEARED, store)
      return res.status(200).json({
        status: 'ok',
        msg: 'auction cleared',
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
      if (
        !store.currentPlayer ||
        playerId !== store.currentPlayer.id ||
        store.state != 'progress'
      ) {
        return res.status(400).json({
          status: 'error',
          msg: 'auction not in progress state',
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

      // else create bid in the auctionState and reinitialize timer
      clearInterval(auctionTimer)
      return updateStore({
        'currentPlayer.bids': [...store.currentPlayer.bids, store.bids.length],
        'currentPlayer.bidAmount': bidAmount + BID_INCREASE,
        'currentPlayer.clock': AUCTION_INTERVAL_IN_SEC,
        bids: [
          ...store.bids,
          { playerId, teamId, amount: bidAmount, timestamp: Date.now() },
        ],
      }).then((store) => {
        setAuctionInterval()
        // updating clients
        refreshClients(eventType.BID, store)
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
