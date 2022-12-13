const mongoose = require('mongoose')
const Schema = mongoose.Schema

const AccountSchema = Schema({
  name: {
    type: String,
    required: true,
  },
  totalCount: {
    type: Number,
  },
  participantsCount: {
    type: Number,
  },
})

module.exports = mongoose.model('Account', AccountSchema)
