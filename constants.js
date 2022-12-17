exports.BUDGET = process.env.BUDGET || 50000
exports.DEFAULT_BID_AMOUNT = process.env.BID_AMOUNT || 1000
exports.BID_INCREASE = process.env.BID_INCREASE || 100
exports.AUCTION_INTERVAL_IN_SEC = process.env.AUCTION_INTERVAL_IN_SEC || 10
// for preventing infinite loop of intervals
exports.MAX_INTERVAL_ITERATIONS = 1000
