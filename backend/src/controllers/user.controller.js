const { query } = require('../config/db');
const { decryptText } = require('../utils/secureText');

async function getMyProfile(req, res, next) {
	try {
		const userResult = await query('SELECT id, name, email, created_at FROM users WHERE id = $1', [req.userId]);
		const user = userResult.rows[0];
		if (!user) return res.status(404).json({ success: false, message: 'User not found' });

		const skillsResult = await query(
			`SELECT
			  s.id,
			  s.user_id,
			  s.title,
			  s.description,
			  s.created_at,
			  COALESCE(rep.average_rating, 0) AS skill_average_rating,
			  COALESCE(rep.ratings_count, 0) AS skill_ratings_count
			FROM skills s
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
			WHERE s.user_id = $1
			ORDER BY s.created_at DESC`,
			[req.userId]
		);

		const completedCountResult = await query(
			`SELECT COUNT(*)::int AS count
			 FROM exchanges
			 WHERE status = 'completed'
			   AND (requester_id = $1 OR owner_id = $1)`,
			[req.userId]
		);

		const reputationResult = await query(
			`SELECT
			  COALESCE(ROUND(AVG(rating)::numeric, 2), 0)::float AS average_rating,
			  COUNT(*)::int AS ratings_count
			 FROM exchange_feedback
			 WHERE to_user_id = $1`,
			[req.userId]
		);

		return res.json({
			success: true,
			profile: {
				user,
				skills: skillsResult.rows,
				completedExchangesCount: completedCountResult.rows[0]?.count ?? 0,
				reputation: {
					averageRating: reputationResult.rows[0]?.average_rating ?? 0,
					ratingsCount: reputationResult.rows[0]?.ratings_count ?? 0,
				},
			},
		});
	} catch (err) {
		return next(err);
	}
}

async function getPublicProfile(req, res, next) {
	try {
		const userId = Number(req.params.id);
		if (!Number.isInteger(userId) || userId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid user id' });
		}

		const userResult = await query('SELECT id, name, created_at FROM users WHERE id = $1', [userId]);
		const user = userResult.rows[0];
		if (!user) return res.status(404).json({ success: false, message: 'User not found' });

		const skillsResult = await query(
			`SELECT
			  s.id,
			  s.user_id,
			  s.title,
			  s.description,
			  s.created_at,
			  COALESCE(rep.average_rating, 0) AS skill_average_rating,
			  COALESCE(rep.ratings_count, 0) AS skill_ratings_count
			FROM skills s
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
			WHERE s.user_id = $1
			ORDER BY s.created_at DESC`,
			[userId]
		);

		const completedCountResult = await query(
			`SELECT COUNT(*)::int AS count
			 FROM exchanges
			 WHERE status = 'completed'
			   AND (requester_id = $1 OR owner_id = $1)`,
			[userId]
		);

		const reputationResult = await query(
			`SELECT
			  COALESCE(ROUND(AVG(rating)::numeric, 2), 0)::float AS average_rating,
			  COUNT(*)::int AS ratings_count
			 FROM exchange_feedback
			 WHERE to_user_id = $1`,
			[userId]
		);

		return res.json({
			success: true,
			profile: {
				user,
				skills: skillsResult.rows,
				completedExchangesCount: completedCountResult.rows[0]?.count ?? 0,
				reputation: {
					averageRating: reputationResult.rows[0]?.average_rating ?? 0,
					ratingsCount: reputationResult.rows[0]?.ratings_count ?? 0,
				},
			},
		});
	} catch (err) {
		return next(err);
	}
}

async function listPublicReviews(req, res, next) {
	try {
		const userId = Number(req.params.id);
		if (!Number.isInteger(userId) || userId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid user id' });
		}

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
			  fu.name AS from_name,
			  s.id AS skill_id,
			  s.title AS skill_title
			FROM exchange_feedback f
			JOIN exchanges e ON e.id = f.exchange_id
			JOIN users fu ON fu.id = f.from_user_id
			LEFT JOIN skills s
			  ON s.id = CASE
			    WHEN f.to_user_id = e.owner_id THEN e.skill_requested_id
			    WHEN f.to_user_id = e.requester_id THEN e.skill_offered_id
			    ELSE NULL
			  END
			WHERE f.to_user_id = $1
			  AND e.status = 'completed'
			ORDER BY f.created_at DESC
			LIMIT $2 OFFSET $3`,
			[userId, limit, offset]
		);

		const countResult = await query(
			`SELECT COUNT(*)::int AS count
			 FROM exchange_feedback f
			 JOIN exchanges e ON e.id = f.exchange_id
			 WHERE f.to_user_id = $1
			   AND e.status = 'completed'`,
			[userId]
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

async function listUsers(req, res, next) {
	try {
		const limitRaw = req.query.limit;
		const offsetRaw = req.query.offset;
		const limit = Math.min(Math.max(Number(limitRaw || 50), 1), 200);
		const offset = Math.max(Number(offsetRaw || 0), 0);

		const result = await query(
			`SELECT id, name, created_at
			 FROM users
			 ORDER BY created_at DESC
			 LIMIT $1 OFFSET $2`,
			[limit, offset]
		);

		return res.json({ success: true, users: result.rows, pagination: { limit, offset } });
	} catch (err) {
		return next(err);
	}
}

module.exports = { getMyProfile, getPublicProfile, listPublicReviews, listUsers };
