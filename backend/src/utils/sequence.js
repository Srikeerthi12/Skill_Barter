const Counter = require('../models/counter.model');

async function nextId(sequenceName) {
	const counter = await Counter.findOneAndUpdate(
		{ _id: String(sequenceName) },
		{ $inc: { seq: 1 } },
		{ upsert: true, new: true, setDefaultsOnInsert: true }
	).lean();
	return counter.seq;
}

module.exports = { nextId };
