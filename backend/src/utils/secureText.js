const crypto = require('crypto');
const { env } = require('../config/env');

const PREFIX = 'enc:v1:';

function getKeyBuffer() {
	const raw = String(env.MESSAGE_ENCRYPTION_KEY || '').trim();
	if (!raw) return null;

	// Accept hex (64 chars) or base64 (44 chars typical for 32 bytes)
	let buf = null;
	if (/^[0-9a-fA-F]{64}$/.test(raw)) {
		buf = Buffer.from(raw, 'hex');
	} else {
		try {
			buf = Buffer.from(raw, 'base64');
		} catch {
			buf = null;
		}
	}

	if (!buf || buf.length !== 32) return null;
	return buf;
}

function encryptText(plainText) {
	const key = getKeyBuffer();
	const text = String(plainText ?? '');
	if (!key) return text;
	if (!text) return '';
	if (text.startsWith(PREFIX)) return text;

	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
	const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	const packed = Buffer.concat([iv, tag, ciphertext]).toString('base64');
	return `${PREFIX}${packed}`;
}

function decryptText(value) {
	const key = getKeyBuffer();
	const text = String(value ?? '');
	if (!key) return text;
	if (!text) return '';
	if (!text.startsWith(PREFIX)) return text;

	try {
		const packedB64 = text.slice(PREFIX.length);
		const packed = Buffer.from(packedB64, 'base64');
		if (packed.length < 12 + 16 + 1) return '';

		const iv = packed.subarray(0, 12);
		const tag = packed.subarray(12, 28);
		const ciphertext = packed.subarray(28);

		const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
		decipher.setAuthTag(tag);
		const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
		return plain.toString('utf8');
	} catch {
		// If key changed or data corrupted, fail closed (don't leak ciphertext)
		return '';
	}
}

module.exports = { encryptText, decryptText };
