exports.DEFAULT_BID_AMOUNT = parseInt(process.env.BID_AMOUNT) || 5000
exports.BID_INCREASE = parseInt(process.env.BID_INCREASE) || 500
exports.AUCTION_INTERVAL_IN_SEC =
  parseInt(process.env.AUCTION_INTERVAL_IN_SEC) || 30
