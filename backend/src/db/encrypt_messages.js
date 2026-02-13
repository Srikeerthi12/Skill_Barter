const { connectDb, query, getPool } = require('../config/db');
const { encryptText } = require('../utils/secureText');

async function run() {
	// Fail fast if encryption is not enabled, to avoid looping forever.
	const probe = encryptText('probe');
	if (probe === 'probe' || !String(probe).startsWith('enc:v1:')) {
		throw new Error(
			'MESSAGE_ENCRYPTION_KEY is missing/invalid. Set a 32-byte key (hex or base64) in backend/.env before running this migration.'
		);
	}

	await connectDb();

	const batchSize = 200;
	let updatedTotal = 0;
	let lastId = 0;

	while (true) {
		const rows = await query(
			`SELECT id, body
			 FROM exchange_messages
			 WHERE body IS NOT NULL
			   AND body <> ''
			   AND body NOT LIKE 'enc:v1:%'
			   AND id > $2
			 ORDER BY id ASC
			 LIMIT $1`,
			[batchSize, lastId]
		);

		if (!rows.rows.length) break;

		for (const row of rows.rows) {
			lastId = Number(row.id) || lastId;
			const encrypted = encryptText(row.body);
			if (encrypted === row.body) continue;
			await query('UPDATE exchange_messages SET body = $1 WHERE id = $2', [encrypted, row.id]);
			updatedTotal += 1;
		}
	}

	// eslint-disable-next-line no-console
	console.log(`Encrypted ${updatedTotal} message(s).`);
	await getPool().end();
}

run().catch(async (err) => {
	// eslint-disable-next-line no-console
	console.error('Failed to encrypt messages:', err);
	try {
		await getPool().end();
	} catch {
		// ignore
	}
	process.exit(1);
});
