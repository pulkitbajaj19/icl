const router = require('express').Router()

const auctionController = require('../controllers/auction')

// POST  start auction
router.post('/start', auctionController.startAuction)

// GET pause auction
router.get('/pause', auctionController.pauseAuction)

// GET auction data
router.get('/data', auctionController.getData)

// POST bid on player
router.post('/bid', auctionController.postBid)

module.exports = router
