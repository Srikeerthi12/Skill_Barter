const { connectDb, query, getPool } = require('../config/db');
const { encryptText } = require('../utils/secureText');

function assertEncryptionEnabled() {
	const probe = encryptText('probe');
	if (probe === 'probe' || !String(probe).startsWith('enc:v1:')) {
		throw new Error(
			'MESSAGE_ENCRYPTION_KEY is missing/invalid. Set a 32-byte key (hex or base64) in backend/.env before running this migration.'
		);
	}
}

async function encryptTableColumn({
	table,
	idColumn,
	textColumn,
	batchSize = 200,
}) {
	let updatedTotal = 0;
	let lastId = 0;

	while (true) {
		const rows = await query(
			`SELECT ${idColumn} AS id, ${textColumn} AS val
			 FROM ${table}
			 WHERE ${textColumn} IS NOT NULL
			   AND ${textColumn} <> ''
			   AND ${textColumn} NOT LIKE 'enc:v1:%'
			   AND ${idColumn} > $2
			 ORDER BY ${idColumn} ASC
			 LIMIT $1`,
			[batchSize, lastId]
		);

		if (!rows.rows.length) break;

		for (const row of rows.rows) {
			lastId = Number(row.id) || lastId;
			const encrypted = encryptText(row.val);
			if (encrypted === row.val) continue;
			await query(`UPDATE ${table} SET ${textColumn} = $1 WHERE ${idColumn} = $2`, [encrypted, row.id]);
			updatedTotal += 1;
		}
	}

	return updatedTotal;
}

async function run() {
	assertEncryptionEnabled();
	await connectDb();

	let total = 0;
	// Hide free-text request messages
	total += await encryptTableColumn({ table: 'exchanges', idColumn: 'id', textColumn: 'message' });
	// Hide free-text feedback comments
	total += await encryptTableColumn({ table: 'exchange_feedback', idColumn: 'id', textColumn: 'comment' });
	// Hide uploaded file original names
	total += await encryptTableColumn({ table: 'exchange_message_attachments', idColumn: 'id', textColumn: 'original_name' });

	// eslint-disable-next-line no-console
	console.log(`Encrypted ${total} value(s) across sensitive columns.`);
	await getPool().end();
}

run().catch(async (err) => {
	// eslint-disable-next-line no-console
	console.error('Failed to encrypt sensitive data:', err);
	try {
		await getPool().end();
	} catch {
		// ignore
	}
	process.exit(1);
});
