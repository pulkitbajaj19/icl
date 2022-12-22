const Player = require('../models/player')

exports.getAllPlayers = (req, res, next) => {
  Player.find()
    .populate('accountId')
    .lean()
    .then((players) => {
      return res.json({
        status: 'ok',
        msg: 'players fetched successfully',
        players: players,
      })
    })
    .catch((err) => {
      next(err)
    })
}

exports.getPlayerInfo = (req, res, next) => {
  const { playerId } = req.params
  Player.findById(playerId)
    .populate('accountId')
    .lean()
    .then((player) => {
      return res.json({
        status: 'ok',
        msg: 'player info fetched successsfully',
        player: player,
      })
    })
    .catch((err) => {
      next(err)
    })
}
