const mongoose = require('mongoose');
const { env } = require('./env');

let didConnect = false;

function getMongoUri() {
	return env.MONGODB_URI || env.DATABASE_URL;
}

async function connectDb() {
	if (didConnect && mongoose.connection.readyState === 1) return mongoose.connection;

	const uri = getMongoUri();
	if (!uri) {
		throw new Error('Missing MongoDB connection string. Set MONGODB_URI (preferred) or DATABASE_URL.');
	}

	await mongoose.connect(uri, {
		autoIndex: env.NODE_ENV !== 'production',
	});
	if (mongoose.connection.readyState !== 1) {
		throw new Error('Failed to connect to MongoDB');
	}
	// Normalize for existing callers.
	didConnect = true;
	return mongoose.connection;
}

module.exports = { connectDb };

