const Team = require('../models/team')

exports.getAllTeams = (req, res, next) => {
  Team.find()
    .lean()
    .then((teams) => {
      return res.json({
        status: 'ok',
        msg: 'teams fetched successfully',
        teams: teams,
      })
    })
}

exports.getTeamInfo = (req, res, next) => {
  const { teamId } = req.params
  Team.findById(teamId)
    .lean()
    .then((team) => {
      return res.json({
        status: 'ok',
        msg: 'team info fetched successfully',
        team: team,
      })
    })
}

exports.getAllOwners = (req, res, next) => {
  Team.find()
    .populate('teamOwner.playerId')
    .populate('teamOwner.userId')
    .then((teams) => {
      const teamOwners = teams.map((team) => ({
        ...team.teamOwner.playerId,
        email: team.teamOwner.userId.email,
        teamName: team.name,
      }))
      return res.json({
        status: 'ok',
        msg: 'team owners fetched successfully',
        teamOwners: teamOwners,
      })
    })
}

exports.getOwnerById = (req, res, next) => {
  const { ownerId } = req.params
  Team.find({ 'teamOwner.playerId': ownerId })
    .populate('teamOwner.playerId')
    .populate('teamOwner.userId')
    .then((team) => {
      const teamOwner = {
        ...team.teamOwner.playerId,
        email: team.teamOwner.userId.email,
        teamName: team.name,
      }
      return res.json({
        status: 'ok',
        msg: 'team owner fetched successfully',
        teamOwner: teamOwner,
      })
    })
}
