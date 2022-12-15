const Player = require('../models/player')

exports.getAllPlayers = (req, res, next) => {
  Player.find()
    .lean()
    .then((players) => {
      return res.json({
        status: 'ok',
        msg: 'players fetched successfully',
        players: players,
      })
    })
}

exports.getPlayerInfo = (req, res, next) => {
  const { playerId } = req.params
  Player.findById(playerId)
    .lean()
    .then((player) => {
      return res.json({
        status: 'ok',
        msg: 'player info fetched successsfully',
        player: player,
      })
    })
}