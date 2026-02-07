const { Pool } = require('pg');
const { env } = require('./env');

let pool;

function buildPoolConfig() {
	const connectionString = env.DATABASE_URL || env.PG_CONNECTION_STRING;
	if (connectionString) {
		return {
			connectionString,
			ssl: env.PGSSL ? { rejectUnauthorized: false } : undefined,
		};
	}

	return {
		host: env.PGHOST,
		port: env.PGPORT,
		database: env.PGDATABASE,
		user: env.PGUSER,
		password: env.PGPASSWORD,
		ssl: env.PGSSL ? { rejectUnauthorized: false } : undefined,
	};
}

async function connectDb() {
	if (pool) return pool;

	pool = new Pool(buildPoolConfig());
	await pool.query('SELECT 1');
	return pool;
}

function getPool() {
	if (!pool) {
		throw new Error('Database not connected. Call connectDb() first.');
	}
	return pool;
}

async function query(text, params) {
	return getPool().query(text, params);
}

module.exports = { connectDb, getPool, query };

