const fs = require('fs');
const path = require('path');

const { connectDb, query, getPool } = require('../config/db');

async function init() {
	await connectDb();

	const schemaPath = path.join(__dirname, 'schema.sql');
	const sql = fs.readFileSync(schemaPath, 'utf8');

	await query(sql);

	// eslint-disable-next-line no-console
	console.log('Database schema ensured.');

	await getPool().end();
}

init().catch((err) => {
	// eslint-disable-next-line no-console
	console.error('Failed to init DB:', err);
	process.exit(1);
});
