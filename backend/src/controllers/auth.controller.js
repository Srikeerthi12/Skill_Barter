const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { env } = require('../config/env');
const User = require('../models/user.model');
const { nextId } = require('../utils/sequence');

async function register(req, res, next) {
	try {
		const { name, email, password } = req.body || {};
		if (!name || !email || !password) {
			return res.status(400).json({ success: false, message: 'name, email, password are required' });
		}

		const passwordHash = await bcrypt.hash(String(password), 10);
		const user = await User.create({
			id: await nextId('users'),
			name: String(name),
			email: String(email).toLowerCase(),
			password_hash: passwordHash,
		});

		return res.status(201).json({
			success: true,
			user: { id: user.id, name: user.name, email: user.email },
		});
	} catch (err) {
		// Duplicate key
		if (err && err.code === 11000) {
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

		const user = await User.findOne({ email: String(email).toLowerCase() })
			.select({ id: 1, name: 1, email: 1, password_hash: 1 })
			.lean();
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
		const userId = Number(req.userId);
		if (!Number.isInteger(userId) || userId <= 0) {
			return res.json({ success: true, user: null });
		}

		const user = await User.findOne({ id: userId }).select({ id: 1, name: 1, email: 1 }).lean();
		return res.json({ success: true, user: user || null });
	} catch (err) {
		return next(err);
	}
}

module.exports = { register, login, me };

