const dotenv = require('dotenv');
const path = require('path');

// Always load backend/.env (even if the process is started from repo root)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const env = {
	NODE_ENV: process.env.NODE_ENV || 'development',
	PORT: Number(process.env.PORT || 5000),

	// Prefer a single URL (easiest with pgAdmin / hosted Postgres)
	DATABASE_URL: process.env.DATABASE_URL || '',
	PG_CONNECTION_STRING: process.env.PG_CONNECTION_STRING || '',

	JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_change_me',
	JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

	// Or use individual fields (only used if DATABASE_URL is empty)
	PGHOST: process.env.PGHOST || 'localhost',
	PGPORT: Number(process.env.PGPORT || 5432),
	PGDATABASE: process.env.PGDATABASE || 'skill_bartering',
	PGUSER: process.env.PGUSER || 'postgres',
	PGPASSWORD: process.env.PGPASSWORD || '',
	PGSSL: (process.env.PGSSL || 'false').toLowerCase() === 'true',
};

module.exports = { env };

