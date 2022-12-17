const mongoose = require('mongoose')
const Schema = mongoose.Schema

const PlayerSchema = Schema({
  name: {
    type: String,
    required: true,
  },
  accountId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Account',
  },
  employeeId: {
    type: Number,
  },
  email: {
    type: String,
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
  },
  skill: {
    type: String,
    enum: ['Bowler', 'Spinner', 'All Rounder', 'Batsman', 'Keeper'],
  },
  rating: {
    type: Number,
  },
  bio: {
    type: String,
  },
  imageUrl: {
    type: String,
  },
  bids: [{ type: Schema.Types.ObjectId, ref: 'Bid' }],
})

module.exports = mongoose.model('Player', PlayerSchema)
