const mongoose = require('mongoose');

const exchangeSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    requester_id: { type: Number, required: true, index: true },
    owner_id: { type: Number, required: true, index: true },

    // Final pairing chosen on acceptance.
    skill_offered_id: { type: Number, default: null },
    skill_requested_id: { type: Number, default: null },

    // Negotiation arrays.
    offered_skills: { type: [Number], default: [] },
    interested_skills: { type: [Number], default: [] },

    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'],
      default: 'pending',
      index: true,
    },
    message: { type: String, default: '' },

    completed_by_requester_at: { type: Date, default: null },
    completed_by_owner_at: { type: Date, default: null },
    completed_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('Exchange', exchangeSchema);
