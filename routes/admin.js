const router = require('express').Router()
const adminController = require('../controllers/admin')

// POST add player
router.post('/player/add', adminController.addPlayer)

// POST edit player
router.post('/player/edit', adminController.editPlayer)

// DELETE team
router.delete('/player/:playerId', adminController.deletePlayer)

// POST add team
router.post('/team/add', adminController.addTeam)

// POST edit team
router.post('/team/edit', adminController.editTeam)

// DELETE team
router.delete('/team/:teamId', adminController.deleteTeam)

// POST add account
router.post('/account/add', adminController.addAccount)

// POST edit account
router.post('/account/edit', adminController.editAccount)

// DELETE ACCOUNT
router.delete('/account/:accountId', adminController.deleteAccount)

// POST set team-owner
router.post('/teamowner/patch', adminController.setTeamOwner)

// POST  add user
router.post('/user/add', adminController.addUser)

module.exports = router
