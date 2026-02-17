const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
	{
		id: { type: Number, required: true, index: true },
		url: { type: String, required: true },
		mime_type: { type: String, default: '' },
		original_name: { type: String, default: '' },
		size_bytes: { type: Number, default: 0 },
	},
	{ _id: false }
);

const reactionSchema = new mongoose.Schema(
	{
		emoji: { type: String, required: true },
		user_id: { type: Number, required: true },
		created_at: { type: Date, default: Date.now },
	},
	{ _id: false }
);

const exchangeMessageSchema = new mongoose.Schema(
	{
		id: { type: Number, required: true, unique: true, index: true },
		exchange_id: { type: Number, required: true, index: true },
		from_user_id: { type: Number, required: true, index: true },
		to_user_id: { type: Number, required: true, index: true },
		body: { type: String, default: '' },
		delivered_at: { type: Date, default: Date.now },
		read_at: { type: Date, default: null },
		attachments: { type: [attachmentSchema], default: [] },
		reactions: { type: [reactionSchema], default: [] },
	},
	{ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

exchangeMessageSchema.index({ exchange_id: 1, created_at: 1 });

module.exports = mongoose.model('ExchangeMessage', exchangeMessageSchema);
