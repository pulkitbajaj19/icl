// import modules
const bcryptjs = require('bcryptjs')

const Player = require('../models/player')
const Account = require('../models/account')
const Team = require('../models/team')
const User = require('../models/user')
const account = require('../models/account')

exports.addPlayer = (req, res, next) => {
  const { name, accountId, employeeId, email, skill, bio } = req.body
  // check validity of name
  if (!name) {
    return res.status(400).json({
      status: 'error',
      msg: 'Name is undefined',
    })
  }
  // check validity of accountId
  if (!accountId) {
    return res.status(400).json({
      status: 'error',
      msg: 'AccountId is undefined',
    })
  }
  // set imageurl if image is uploaded
  let imageUrl
  if (req.file) {
    imageUrl = req.file.path
  }
  // create player object
  const player = new Player({
    name,
    accountId,
    employeeId,
    email,
    skill,
    bio,
    imageUrl,
  })

  player
    .save()
    .then((player) => {
      return Account.findById(accountId)
        .then((account) => {
          account.participantsCount = account.participantsCount + 1
          return account.save()
        })
        .then((account) => {
          return res.status(200).json({
            status: 'ok',
            msg: 'player saved',
            player: player,
          })
        })
    })
    .catch((err) => {
      next(err)
    })
}

exports.editPlayer = (req, res) => {
  const { playerId, name, accountId, employeeId, email, skill, bio, imageUrl } =
    req.body
  Player.findById(playerId)
    .then((player) => {
      player.name = name
      player.employeeId = employeeId
      player.accountId = accountId
      player.email = email
      player.skill = skill
      player.bio = bio
      player.imageUrl = imageUrl
      return player.save()
    })
    .then((player) => {
      return res.json({
        status: 'ok',
        msg: 'player edited',
        player: player,
      })
    })
}

exports.deletePlayer = (req, res, next) => {
  const { playerId } = req.params
  Player.findByIdAndDelete(playerId)
    .then((player) => {
      if (!player) {
        return res.status(400).json({
          status: 'error',
          msg: 'Player not found',
        })
      }
      // decrease participant count of account
      return Account.findById(player.accountId)
        .then((account) => {
          if (account) {
            account.participantsCount -= 1
            return account.save()
          }
        })
        .then((account) => {
          return res.status(200).json({
            status: 'ok',
            msg: 'Deleted',
            player: player,
          })
        })
    })
    .catch((err) => {
      next(err)
    })
}

exports.addAccount = (req, res) => {
  const { name, totalCount } = req.body
  if (!name)
    return res.status(400).json({
      status: 'error',
      msg: 'Insufficient data',
    })
  const account = new Account({
    name,
    totalCount,
  })
  account.save().then((account) => {
    return res.json({
      status: 'ok',
      msg: 'account added',
      account: account,
    })
  })
}

exports.editAccount = (req, res) => {
  const { accountId, name, totalCount } = req.body
  Account.findById(accountId)
    .then((account) => {
      account.name = name
      account.totalCount = totalCount
      return account.save()
    })
    .then((account) => {
      return res.json({
        status: 'ok',
        msg: 'account edited',
        account: account,
      })
    })
}

exports.deleteAccount = (req, res) => {
  console.log('deleting account')
  const { accountId } = req.params
  Account.findByIdAndDelete(accountId).then((account) => {
    if (!account) {
      return res.status(400).json({
        status: 'error',
        msg: 'account not found',
      })
    }
    return res.status(200).json({
      status: 'ok',
      msg: 'account deleted',
      account: account,
    })
  })
}

exports.addTeam = (req, res) => {
  console.log('-----body', req.body)
  console.log('----file: ', req.file)
  const { name } = req.body
  if (!name)
    return res.status(400).json({ status: 'error', msg: 'Insufficient data' })

  // else add the team
  let imageUrl
  if (req.file) {
    imageUrl = req.file.path
  }
  const team = new Team({
    name,
    imageUrl,
  })
  team.save().then((team) => {
    return res.json({
      status: 'ok',
      msg: 'team added',
      team: team,
    })
  })
}

exports.editTeam = (req, res) => {
  const { teamId, name, imageUrl } = req.body
  Team.findById(teamId)
    .then((team) => {
      team.name = name
      team.imageUrl = imageUrl
      return team.save()
    })
    .then((team) => {
      return res.json({
        status: 'ok',
        msg: 'team edited',
        team: team,
      })
    })
}

exports.deleteTeam = (req, res) => {
  const { teamId } = req.params
  Team.findByIdAndDelete(teamId).then((team) => {
    if (!team) {
      return res.status(400).json({
        status: 'error',
        msg: 'team not found',
      })
    }
    return res.status(200).json({
      status: 'ok',
      msg: 'team deleted',
      team: team,
    })
  })
}

exports.setTeamOwner = async (req, res) => {
  const { teamId, playerId, email, password, budget } = req.body
  Promise.all([
    Team.findById(teamId).populate('teamOwner.userId'),
    bcryptjs.hash(password, 12),
  ]).then(([team, hashedPassword]) => {
    let user
    if (team.teamOwner) {
      user = team.teamOwner.userId
      user.email = email
      user.password = hashedPassword
      user.role = 'owner'
    } else {
      user = new User({
        email: email,
        password: hashedPassword,
        role: 'owner',
      })
    }
    return user
      .save()
      .then((user) => {
        team.teamOwner = {
          userId: user,
          playerId: playerId,
          budget: budget,
        }
        return team.save()
      })
      .then((team) => {
        return res.json({
          status: 'ok',
          msg: 'team owner is set successfully',
          teamOwner: team.teamOwner,
        })
      })
  })
}

exports.addUser = (req, res) => {
  const { email, password, role, name } = req.body
  // check if user exists
  User.findOne({ email })
    .then((user) => {
      if (user) {
        return res.status(400).json({
          status: 'error',
          msg: 'User exists',
          existingUser: {
            email: user.email,
            name: user.name,
            role: user.role,
          },
        })
      }
      // create new user
      const newUser = new User({
        name: name,
        email: email,
        role: role,
      })
      return bcryptjs.hash(password, 12).then((hashedPassword) => {
        newUser.password = hashedPassword
        return newUser.save()
      })
    })
    .then((user) => {
      res.status(200).json({
        status: 'ok',
        msg: 'User created',
        user: user,
      })
    })
}

exports.addUser = (req, res) => {
  const { email, password, role, name } = req.body
  // check if user exists
  User.findOne({ email })
    .then((user) => {
      if (user) {
        return res.status(400).json({
          status: 'error',
          msg: 'User exists',
          existingUser: {
            email: user.email,
            name: user.name,
            role: user.role,
          },
        })
      }
      // create new user
      const newUser = new User({
        name: name,
        email: email,
        role: role,
      })
      return bcryptjs.hash(password, 12).then((hashedPassword) => {
        newUser.password = hashedPassword
        return newUser.save()
      })
    })
    .then((user) => {
      res.status(200).json({
        status: 'ok',
        msg: 'User created',
        user: user,
      })
    })
}