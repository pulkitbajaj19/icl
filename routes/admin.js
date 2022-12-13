const router = require('express').Router()
const adminController = require('../controllers/admin')

// POST add player
router.post('/player/add', adminController.addPlayer)

// POST edit player
router.post('/player/edit', adminController.editPlayer)

// POST add team
router.post('/team/add', adminController.addTeam)

// POST edit team
router.post('/team/edit', adminController.editTeam)

// POST add account
router.post('/account/add', adminController.addAccount)

// POST edit account
router.post('/account/edit', adminController.editAccount)

// POST set team-owner
router.post('/teamowner/patch', adminController.setTeamOwner)

module.exports = router
