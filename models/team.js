const mongoose = require('mongoose')
const Schema = mongoose.Schema

const TeamSchema = Schema({
  name: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
  },
  teamOwner: {
    type: {
      playerId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'Player',
      },
      userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'User',
      },
      budget: {
        type: Number,
        required: true,
      },
      bids: [{ type: Schema.Types.ObjectId, ref: 'Bid' }],
    },
    _id: false,
  },
  players: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
})

module.exports = mongoose.model('Team', TeamSchema)
