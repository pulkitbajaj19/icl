const Account = require('../models/account')

exports.getAllAccounts = (req, res, next) => {
  Account.find()
    .lean()
    .then((accounts) => {
      return res.json({
        status: 'ok',
        msg: 'all accounts fetched',
        accounts: accounts,
      })
    })
}

exports.getAccountById = (req, res, next) => {
  const { accountId } = req.params
  if (accountId) {
    Account.findById(accountId)
      .lean()
      .then((account) => {
        return res.json({
          status: 'ok',
          msg: 'account fetched',
          account: account,
        })
      })
  }
}
