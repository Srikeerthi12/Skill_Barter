const mongoose = require('mongoose');

const exchangeSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    skillOffered: { type: mongoose.Schema.Types.ObjectId, ref: 'Skill', required: true },
    skillRequested: { type: mongoose.Schema.Types.ObjectId, ref: 'Skill', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    message: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Exchange', exchangeSchema);
