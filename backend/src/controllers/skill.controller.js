const { query } = require('../config/db');

async function listSkills(req, res, next) {
	try {
		const result = await query(
			`SELECT s.id, s.user_id, u.name AS owner_name, s.title, s.description, s.created_at
			 FROM skills s
			 JOIN users u ON u.id = s.user_id
			 ORDER BY s.created_at DESC`
		);
		return res.json({ success: true, skills: result.rows });
	} catch (err) {
		return next(err);
	}
}

async function getSkill(req, res, next) {
	try {
		const result = await query(
			`SELECT s.id, s.user_id, u.name AS owner_name, s.title, s.description, s.created_at
			 FROM skills s
			 JOIN users u ON u.id = s.user_id
			 WHERE s.id = $1`,
			[req.params.id]
		);
		if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Skill not found' });
		return res.json({ success: true, skill: result.rows[0] });
	} catch (err) {
		return next(err);
	}
}

async function createSkill(req, res, next) {
	try {
		const { title, description } = req.body || {};
		if (!title) return res.status(400).json({ success: false, message: 'title is required' });
		const result = await query(
			'INSERT INTO skills(user_id, title, description) VALUES ($1, $2, $3) RETURNING id, user_id, title, description, created_at',
			[req.userId, String(title), description ? String(description) : '']
		);
		return res.status(201).json({ success: true, skill: result.rows[0] });
	} catch (err) {
		return next(err);
	}
}

async function updateSkill(req, res, next) {
	try {
		const { title, description } = req.body || {};
		const existing = await query('SELECT id, user_id FROM skills WHERE id = $1', [req.params.id]);
		if (!existing.rows[0]) return res.status(404).json({ success: false, message: 'Skill not found' });
		if (String(existing.rows[0].user_id) !== String(req.userId)) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}

		const updated = await query(
			'UPDATE skills SET title = COALESCE($1, title), description = COALESCE($2, description) WHERE id = $3 RETURNING id, user_id, title, description, created_at',
			[title !== undefined ? String(title) : null, description !== undefined ? String(description) : null, req.params.id]
		);
		return res.json({ success: true, skill: updated.rows[0] });
	} catch (err) {
		return next(err);
	}
}

async function deleteSkill(req, res, next) {
	try {
		const existing = await query('SELECT id, user_id FROM skills WHERE id = $1', [req.params.id]);
		if (!existing.rows[0]) return res.status(404).json({ success: false, message: 'Skill not found' });
		if (String(existing.rows[0].user_id) !== String(req.userId)) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}
		await query('DELETE FROM skills WHERE id = $1', [req.params.id]);
		return res.json({ success: true });
	} catch (err) {
		return next(err);
	}
}

module.exports = { createSkill, listSkills, getSkill, updateSkill, deleteSkill };

