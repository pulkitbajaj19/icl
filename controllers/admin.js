// import modules
const bcryptjs = require('bcryptjs')

const Player = require('../models/player')
const Account = require('../models/account')
const Team = require('../models/team')
const User = require('../models/user')
const Bid = require('../models/bid')

exports.addPlayer = (req, res, next) => {
  console.log('-----body', req.body)
  const {
    name,
    accountId,
    employeeId,
    email,
    skill,
    level,
    bio,
    gender,
    rating,
  } = req.body
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
    level,
    bio,
    imageUrl,
    gender,
    rating,
  })

  player
    .save()
    .then((player) => {
      return res.status(200).json({
        status: 'ok',
        msg: 'player saved',
        player: player,
      })
      // return Account.findById(accountId)
      //   .then((account) => {
      //     account.participantsCount = account.participantsCount + 1
      //     return account.save()
      //   })
      //   .then((account) => {
      //     return res.status(200).json({
      //       status: 'ok',
      //       msg: 'player saved',
      //       player: player,
      //     })
      //   })
    })
    .catch((err) => {
      next(err)
    })
}

exports.editPlayer = (req, res, next) => {
  console.log('-----------body', req.body)
  const {
    playerId,
    name,
    accountId,
    employeeId,
    email,
    skill,
    level,
    bio,
    gender,
    rating,
  } = req.body
  Player.findById(playerId)
    .then((player) => {
      player.name = name
      player.employeeId = employeeId
      player.accountId = accountId
      player.email = email
      player.skill = skill
      player.level = level
      player.bio = bio
      player.gender = gender
      player.rating = rating
      // set image if provided
      if (req.file) {
        player.imageUrl = req.file.path
      }
      return player.save()
    })
    .then((player) => {
      return res.status(200).json({
        status: 'ok',
        msg: 'player edited',
        player: player,
      })
    })
    .catch((err) => {
      next(err)
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
      // if player is team owner then unlink him from team
      if (player.auctionStatus === 'OWNER' && player.teamId) {
        return Team.findById(player.teamId).then((team) => {
          const userId = team.teamOwner.userId
          team.teamOwner = null
          return Promise.all([
            User.findByIdAndDelete(userId),
            team.save(),
          ]).then(([user, team]) => {
            return res.json({
              status: 'ok',
              msg: 'player deleted and teamowner reset',
              player: player,
              team: team,
              user: user,
            })
          })
        })
      }

      return res.status(200).json({
        status: 'ok',
        msg: 'Deleted',
        player: player,
      })
    })
    .catch((err) => {
      next(err)
    })
}

exports.addAccount = (req, res, next) => {
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
  account
    .save()
    .then((account) => {
      return res.status(200).json({
        status: 'ok',
        msg: 'account added',
        account: account,
      })
    })
    .catch((err) => {
      next(err)
    })
}

exports.editAccount = (req, res, next) => {
  const { accountId, name, totalCount } = req.body
  Account.findById(accountId)
    .then((account) => {
      account.name = name
      account.totalCount = totalCount
      return account.save()
    })
    .then((account) => {
      return res.status(200).json({
        status: 'ok',
        msg: 'account edited',
        account: account,
      })
    })
    .catch((err) => {
      next(err)
    })
}

exports.deleteAccount = (req, res, next) => {
  console.log('deleting account')
  const { accountId } = req.params
  Account.findByIdAndDelete(accountId)
    .then((account) => {
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
    .catch((err) => {
      next(err)
    })
}

exports.addTeam = (req, res, next) => {
  console.log('-----body', req.body)
  console.log('----file: ', req.file)
  const { name, accountId } = req.body
  if (!name)
    return res.status(400).json({ status: 'error', msg: 'Insufficient data' })

  // else add the team
  let imageUrl
  if (req.file) {
    imageUrl = req.file.path
  }
  const team = new Team({
    name,
    accountId,
    imageUrl,
  })
  team
    .save()
    .then((team) => {
      return res.status(200).json({
        status: 'ok',
        msg: 'team added',
        team: team,
      })
    })
    .catch((err) => {
      next(err)
    })
}

exports.editTeam = (req, res, next) => {
  const { teamId, name, accountId } = req.body
  Team.findById(teamId)
    .then((team) => {
      team.name = name
      team.accountId = accountId
      if (req.file) {
        team.imageUrl = req.file.path
      }
      return team.save()
    })
    .then((team) => {
      return res.status(200).json({
        status: 'ok',
        msg: 'team edited',
        team: team,
      })
    })
    .catch((err) => {
      next(err)
    })
}

exports.deleteTeam = (req, res, next) => {
  const { teamId } = req.params
  Team.findByIdAndDelete(teamId)
    .then((team) => {
      if (!team) {
        return res.status(400).json({
          status: 'error',
          msg: 'team not found',
        })
      }
      if (team.teamOwner) {
        const playerId = team.teamOwner.playerId
        const userId = team.teamOwner.userId
        return Promise.all([
          Player.findByIdAndUpdate(playerId, {
            auctionStatus: null,
            teamId: null,
          }),
          User.findByIdAndDelete(userId),
        ]).then(([player, user]) => {
          return res.status(200).json({
            status: 'ok',
            msg: 'user and team deleted',
            team: team,
            player: player,
            user: user,
          })
        })
      } else {
        return res.status(200).json({
          status: 'ok',
          msg: 'team deleted',
          team: team,
        })
      }
    })
    .catch((err) => {
      next(err)
    })
}

exports.setTeamOwner = async (req, res, next) => {
  try {
    const { teamId, playerId, email, password, budget } = req.body
    if (!teamId || !playerId || !email || !password || !budget) {
      return res.status(400).json({
        status: 'error',
        msg: 'Insufficient payload provided',
      })
    }

    // fetch team
    const team = await Team.findById(teamId)
    if (!team)
      return res.status(400).json({
        status: 'error',
        msg: 'Team not present',
      })

    // fetch player
    const player = await Player.findById(playerId)
    if (!player)
      return res.status(400).json({
        status: 'error',
        msg: 'Player not present',
      })

    // create hashed password
    const hashedPassword = await bcryptjs.hash(password, 12)

    let updatedUser
    // if team-owner is present then delink the player as owner and update the existing user account
    if (team.teamOwner) {
      const userId = team.teamOwner.userId
      const prevPlayerId = team.teamOwner.playerId
      if (prevPlayerId) {
        await Player.findByIdAndUpdate(prevPlayerId, {
          auctionStatus: null,
          teamId: null,
        })
      }
      if (userId) {
        updatedUser = await User.findByIdAndUpdate(userId, {
          email: email,
          password: hashedPassword,
          role: 'owner',
        })
      }
    }
    // if team-owner is not present then create a new user
    else {
      updatedUser = new User({
        email: email,
        password: hashedPassword,
        role: 'owner',
      })
      await updatedUser.save()
    }

    // set the teamowner of team
    team.teamOwner = {
      userId: updatedUser ? updatedUser._id : null,
      playerId: playerId,
      budget: budget,
    }
    await team.save()

    // link the player as team owner and assign team to him
    player.teamId = teamId
    player.auctionStatus = 'OWNER'
    await player.save()

    // return the response
    return res.status(200).json({
      status: 'ok',
      msg: 'team owner updated',
      team: team,
      player: player,
      user: updatedUser,
    })
  } catch (err) {
    next(err)
  }
}

exports.addUser = (req, res, next) => {
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
    .catch((err) => {
      next(err)
    })
}

exports.resetAuctionData = async (req, res, next) => {
  try {
    await Player.updateMany(
      { auctionStatus: { $ne: 'OWNER' } },
      { teamId: null, lastBid: null, auctionStatus: null }
    )
    await Account.updateMany({}, { isAuctioned: false })
    await Bid.deleteMany({})
    return res.status(200).json({ status: 'ok', msg: 'reset completed' })
  } catch (err) {
    next(err)
  }
}
