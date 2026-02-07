const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

function requireAuth(req, res, next) {
	try {
		const header = req.headers.authorization || '';
		const [scheme, token] = header.split(' ');
		if (scheme !== 'Bearer' || !token) {
			return res.status(401).json({ success: false, message: 'Unauthorized' });
		}

		const payload = jwt.verify(token, env.JWT_SECRET || 'dev_secret_change_me');
		const userId = payload.sub || payload.userId || payload.id;
		if (!userId) {
			return res.status(401).json({ success: false, message: 'Unauthorized' });
		}

		req.userId = userId;
		return next();
	} catch {
		return res.status(401).json({ success: false, message: 'Unauthorized' });
	}
}

module.exports = { requireAuth };

