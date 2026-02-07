const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { env } = require('../config/env');
const { query } = require('../config/db');

async function register(req, res, next) {
	try {
		const { name, email, password } = req.body || {};
		if (!name || !email || !password) {
			return res.status(400).json({ success: false, message: 'name, email, password are required' });
		}

		const passwordHash = await bcrypt.hash(String(password), 10);
		const result = await query(
			'INSERT INTO users(name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
			[String(name), String(email).toLowerCase(), passwordHash]
		);

		return res.status(201).json({ success: true, user: result.rows[0] });
	} catch (err) {
		// Unique violation
		if (err && err.code === '23505') {
			return res.status(409).json({ success: false, message: 'Email already in use' });
		}
		return next(err);
	}
}

async function login(req, res, next) {
	try {
		const { email, password } = req.body || {};
		if (!email || !password) {
			return res.status(400).json({ success: false, message: 'email and password are required' });
		}

		const result = await query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [
			String(email).toLowerCase(),
		]);
		const user = result.rows[0];
		if (!user) {
			return res.status(401).json({ success: false, message: 'Invalid credentials' });
		}

		const ok = await bcrypt.compare(String(password), user.password_hash);
		if (!ok) {
			return res.status(401).json({ success: false, message: 'Invalid credentials' });
		}

		const token = jwt.sign({ sub: String(user.id) }, env.JWT_SECRET || 'dev_secret_change_me', {
			expiresIn: env.JWT_EXPIRES_IN || '7d',
		});

		return res.json({ success: true, token });
	} catch (err) {
		return next(err);
	}
}

async function me(req, res, next) {
	try {
		const result = await query('SELECT id, name, email FROM users WHERE id = $1', [req.userId]);
		return res.json({ success: true, user: result.rows[0] || null });
	} catch (err) {
		return next(err);
	}
}

module.exports = { register, login, me };

