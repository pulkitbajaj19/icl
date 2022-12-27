const Account = require('../models/account')
const Player = require('../models/player')

exports.getAllAccounts = (req, res, next) => {
  Promise.all([Account.find().lean(), Player.find().lean()]).then(
    ([accounts, players]) => {
      const accountsData = accounts.map((account) => {
        const accountId = account._id.toString()
        const accountPlayers = players.filter(
          (player) => player.accountId.toString() === accountId
        )
        return {
          ...account,
          participantsCount: accountPlayers.length,
          players: accountPlayers,
        }
      })
      return res.status(200).json({
        status: 'ok',
        msg: 'accounts fetched',
        accounts: accountsData,
      })
    }
  )
}

exports.getAccountById = (req, res, next) => {
  const { accountId } = req.params
  if (accountId) {
    Promise.all([
      Account.findById(accountId).lean(),
      Player.find({ accountId }).lean(),
    ]).then(([account, players]) => {
      return res.json({
        status: 'ok',
        msg: 'account fetched',
        account: {
          ...account,
          participantsCount: players.length,
          players: players,
        },
      })
    })
  }
}
