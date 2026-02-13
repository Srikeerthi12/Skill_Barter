const { query } = require('../config/db');
const { decryptText } = require('../utils/secureText');

async function listSkills(req, res, next) {
	try {
		const result = await query(
			`SELECT
			  s.id,
			  s.user_id,
			  u.name AS owner_name,
			  s.title,
			  s.description,
			  s.created_at,
			  COALESCE(rep.average_rating, 0) AS skill_average_rating,
			  COALESCE(rep.ratings_count, 0) AS skill_ratings_count
			 FROM skills s
			 JOIN users u ON u.id = s.user_id
			 LEFT JOIN (
			   SELECT
			     r.skill_id,
			     COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0)::float AS average_rating,
			     COUNT(*)::int AS ratings_count
			   FROM (
			     -- Requester rates Owner for the skill_requested (Owner teaches)
			     SELECT e.skill_requested_id AS skill_id, f.rating
			     FROM exchange_feedback f
			     JOIN exchanges e ON e.id = f.exchange_id
			     WHERE e.status = 'completed'
			       AND e.skill_requested_id IS NOT NULL
			       AND f.to_user_id = e.owner_id
			       AND f.from_user_id = e.requester_id

			     UNION ALL

			     -- Owner rates Requester for the skill_offered (Requester teaches)
			     SELECT e.skill_offered_id AS skill_id, f.rating
			     FROM exchange_feedback f
			     JOIN exchanges e ON e.id = f.exchange_id
			     WHERE e.status = 'completed'
			       AND e.skill_offered_id IS NOT NULL
			       AND f.to_user_id = e.requester_id
			       AND f.from_user_id = e.owner_id
			   ) r
			   GROUP BY r.skill_id
			 ) rep ON rep.skill_id = s.id
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
			`SELECT
			  s.id,
			  s.user_id,
			  u.name AS owner_name,
			  s.title,
			  s.description,
			  s.created_at,
			  COALESCE(rep.average_rating, 0) AS skill_average_rating,
			  COALESCE(rep.ratings_count, 0) AS skill_ratings_count
			 FROM skills s
			 JOIN users u ON u.id = s.user_id
			 LEFT JOIN (
			   SELECT
			     r.skill_id,
			     COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0)::float AS average_rating,
			     COUNT(*)::int AS ratings_count
			   FROM (
			     SELECT e.skill_requested_id AS skill_id, f.rating
			     FROM exchange_feedback f
			     JOIN exchanges e ON e.id = f.exchange_id
			     WHERE e.status = 'completed'
			       AND e.skill_requested_id IS NOT NULL
			       AND f.to_user_id = e.owner_id
			       AND f.from_user_id = e.requester_id

			     UNION ALL

			     SELECT e.skill_offered_id AS skill_id, f.rating
			     FROM exchange_feedback f
			     JOIN exchanges e ON e.id = f.exchange_id
			     WHERE e.status = 'completed'
			       AND e.skill_offered_id IS NOT NULL
			       AND f.to_user_id = e.requester_id
			       AND f.from_user_id = e.owner_id
			   ) r
			   GROUP BY r.skill_id
			 ) rep ON rep.skill_id = s.id
			 WHERE s.id = $1`,
			[req.params.id]
		);
		if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Skill not found' });
		return res.json({ success: true, skill: result.rows[0] });
	} catch (err) {
		return next(err);
	}
}

async function listSkillReviews(req, res, next) {
	try {
		const skillId = Number(req.params.id);
		if (!Number.isInteger(skillId) || skillId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid skill id' });
		}

		const skillResult = await query('SELECT id FROM skills WHERE id = $1', [skillId]);
		if (!skillResult.rows[0]) return res.status(404).json({ success: false, message: 'Skill not found' });

		const limitRaw = req.query.limit;
		const offsetRaw = req.query.offset;
		const limit = Math.min(Math.max(Number(limitRaw || 20), 1), 50);
		const offset = Math.max(Number(offsetRaw || 0), 0);

		const rowsResult = await query(
			`SELECT
			  f.id,
			  f.rating,
			  f.comment,
			  f.created_at,
			  f.from_user_id,
			  fu.name AS from_name
			FROM exchange_feedback f
			JOIN exchanges e ON e.id = f.exchange_id
			JOIN users fu ON fu.id = f.from_user_id
			WHERE e.status = 'completed'
			  AND (
			    (e.skill_requested_id = $1 AND f.to_user_id = e.owner_id AND f.from_user_id = e.requester_id)
			    OR
			    (e.skill_offered_id = $1 AND f.to_user_id = e.requester_id AND f.from_user_id = e.owner_id)
			  )
			ORDER BY f.created_at DESC
			LIMIT $2 OFFSET $3`,
			[skillId, limit, offset]
		);

		const countResult = await query(
			`SELECT COUNT(*)::int AS count
			 FROM exchange_feedback f
			 JOIN exchanges e ON e.id = f.exchange_id
			 WHERE e.status = 'completed'
			   AND (
			     (e.skill_requested_id = $1 AND f.to_user_id = e.owner_id AND f.from_user_id = e.requester_id)
			     OR
			     (e.skill_offered_id = $1 AND f.to_user_id = e.requester_id AND f.from_user_id = e.owner_id)
			   )`,
			[skillId]
		);

		return res.json({
			success: true,
			reviews: rowsResult.rows.map((r) => ({
				...r,
				comment: decryptText(r.comment),
			})),
			pagination: {
				limit,
				offset,
				total: countResult.rows[0]?.count ?? 0,
			},
		});
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

		// Rule: skills cannot be deleted if tied to an accepted/completed exchange.
		// Allow deletion only when no exchanges exist OR all related exchanges are pending/rejected.
		const blockingExchanges = await query(
			`SELECT COUNT(*)::int AS count
			 FROM exchanges
			 WHERE (skill_offered_id = $1 OR skill_requested_id = $1)
			   AND status NOT IN ('pending', 'rejected', 'cancelled')`,
			[req.params.id]
		);
		const blockingCount = blockingExchanges.rows[0]?.count ?? 0;
		if (blockingCount > 0) {
			return res.status(409).json({
				success: false,
				message: 'Cannot delete skill: it is tied to an accepted/completed exchange.',
			});
		}

		await query('DELETE FROM skills WHERE id = $1', [req.params.id]);
		return res.json({ success: true });
	} catch (err) {
		return next(err);
	}
}

module.exports = { createSkill, listSkills, getSkill, listSkillReviews, updateSkill, deleteSkill };

