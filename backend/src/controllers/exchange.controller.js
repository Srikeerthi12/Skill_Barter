const { query } = require('../config/db');

async function listLearning(req, res, next) {
	try {
		const result = await query(
			`SELECT e.id,
			        e.requester_id,
			        e.owner_id,
			        e.skill_offered_id,
			        e.skill_requested_id,
			        e.status,
			        e.message,
			        e.created_at,
			        ru.name AS requester_name,
			        ou.name AS owner_name,
			        sr.title AS requested_title,
			        sr.description AS requested_description,
			        so.title AS offered_title,
			        so.description AS offered_description
			 FROM exchanges e
			 JOIN users ru ON ru.id = e.requester_id
			 JOIN users ou ON ou.id = e.owner_id
			 LEFT JOIN skills sr ON sr.id = e.skill_requested_id
			 LEFT JOIN skills so ON so.id = e.skill_offered_id
			 WHERE e.requester_id = $1
			   AND e.status = 'accepted'
			 ORDER BY e.created_at DESC`,
			[req.userId]
		);

		return res.json({ success: true, learning: result.rows });
	} catch (err) {
		return next(err);
	}
}

async function listExchangeRequests(req, res, next) {
	try {
		const result = await query(
			`SELECT e.*,
			        ru.name AS requester_name,
			        ou.name AS owner_name
			 FROM exchanges e
			 JOIN users ru ON ru.id = e.requester_id
			 JOIN users ou ON ou.id = e.owner_id
			 WHERE e.requester_id = $1 OR e.owner_id = $1
			 ORDER BY e.created_at DESC`,
			[req.userId]
		);
		return res.json({ success: true, requests: result.rows });
	} catch (err) {
		return next(err);
	}
}

async function createExchangeRequest(req, res, next) {
	try {
		const { owner, skillOffered, skillRequested, message } = req.body || {};
		if (!owner) {
			return res.status(400).json({ success: false, message: 'owner is required' });
		}

		const result = await query(
			'INSERT INTO exchanges(requester_id, owner_id, skill_offered_id, skill_requested_id, message) VALUES ($1, $2, $3, $4, $5) RETURNING *',
			[
				req.userId,
				Number(owner),
				skillOffered ? Number(skillOffered) : null,
				skillRequested ? Number(skillRequested) : null,
				message ? String(message) : '',
			]
		);

		return res.status(201).json({ success: true, request: result.rows[0] });
	} catch (err) {
		return next(err);
	}
}

async function respondToExchangeRequest(req, res, next) {
	try {
		const { status } = req.body || {};
		if (!['accepted', 'rejected', 'cancelled', 'pending'].includes(status)) {
			return res.status(400).json({ success: false, message: 'Invalid status' });
		}

		const existing = await query('SELECT * FROM exchanges WHERE id = $1', [req.params.id]);
		const ex = existing.rows[0];
		if (!ex) return res.status(404).json({ success: false, message: 'Request not found' });
		if (String(ex.owner_id) !== String(req.userId) && String(ex.requester_id) !== String(req.userId)) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}

		const updated = await query('UPDATE exchanges SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
		return res.json({ success: true, request: updated.rows[0] });
	} catch (err) {
		return next(err);
	}
}

module.exports = { createExchangeRequest, listExchangeRequests, respondToExchangeRequest, listLearning };

