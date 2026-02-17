const mongoose = require('mongoose');

const exchangeFeedbackSchema = new mongoose.Schema(
	{
		id: { type: Number, required: true, unique: true, index: true },
		exchange_id: { type: Number, required: true, index: true },
		from_user_id: { type: Number, required: true, index: true },
		to_user_id: { type: Number, required: true, index: true },
		rating: { type: Number, required: true, min: 1, max: 5 },
		comment: { type: String, default: '' },
	},
	{ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

exchangeFeedbackSchema.index({ exchange_id: 1, from_user_id: 1 }, { unique: true });

module.exports = mongoose.model('ExchangeFeedback', exchangeFeedbackSchema);
