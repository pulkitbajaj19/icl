const router = require('express').Router()

const auctionController = require('../controllers/auction')

// POST  start auction
router.post('/start', auctionController.startAuction)

// POST pause auction
router.post('/pause', auctionController.pauseAuction)

// POST reset auction
router.post('/reset', auctionController.resetAuction)

// GET auction data
router.get('/data', auctionController.getData)

// POST bid on player
router.post('/bid', auctionController.postBid)

module.exports = router
