const router = require('express').Router()

const auctionController = require('../controllers/auction')

// POST  start auction
router.post('/initialize', auctionController.initializeAuction)

// POST next player auction
router.post('/start', auctionController.triggerPlayerAuction)

// POST pause auction
router.post('/pause', auctionController.pauseAuction)

// POST reset auction
router.post('/reset', auctionController.resetAuction)

// GET auction data
router.get('/data', auctionController.getData)

// POST bid on player
router.post('/bid', auctionController.postBid)

// reset db
router.post('/resetdb', async (req, res, next) => {
  const Player = require('../models/player')
  const Account = require('../models/account')
  const Bid = require('../models/bid')
  try {
    await Player.updateMany(
      {},
      { teamId: null, lastBid: null, auctionStatus: null }
    )
    await Account.updateMany({}, { isAuctioned: false })
    await Bid.deleteMany({})
    return res.status(200).json({ status: 'ok', msg: 'reset completed' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
