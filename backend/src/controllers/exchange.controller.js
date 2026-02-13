const { query } = require('../config/db');
const { encryptText, decryptText } = require('../utils/secureText');

async function listChatConversations(req, res, next) {
	try {
		const result = await query(
			`SELECT
			  e.id,
			  CASE
			    WHEN e.status = 'accepted'
			      AND e.completed_by_requester_at IS NOT NULL
			      AND e.completed_by_owner_at IS NOT NULL
			    THEN 'completed'
			    ELSE e.status
			  END AS status,
			  e.requester_id,
			  e.owner_id,
			  ru.name AS requester_name,
			  ou.name AS owner_name,
			  sr.title AS requested_title,
			  so.title AS offered_title,
			  CASE WHEN e.requester_id = $1 THEN e.owner_id ELSE e.requester_id END AS other_user_id,
			  CASE WHEN e.requester_id = $1 THEN ou.name ELSE ru.name END AS other_user_name,
			  lm.body AS last_body,
			  lm.created_at AS last_at,
			  (
			    SELECT COUNT(*)::int
			    FROM exchange_messages m
			    WHERE m.exchange_id = e.id
			      AND m.to_user_id = $1
			      AND m.read_at IS NULL
			  ) AS unread_count
			FROM exchanges e
			JOIN users ru ON ru.id = e.requester_id
			JOIN users ou ON ou.id = e.owner_id
			LEFT JOIN skills sr ON sr.id = e.skill_requested_id
			LEFT JOIN skills so ON so.id = e.skill_offered_id
			LEFT JOIN LATERAL (
			  SELECT body, created_at
			  FROM exchange_messages m
			  WHERE m.exchange_id = e.id
			  ORDER BY m.created_at DESC
			  LIMIT 1
			) lm ON true
			WHERE (e.requester_id = $1 OR e.owner_id = $1)
			  AND e.status IN ('accepted','completed')
			ORDER BY COALESCE(lm.created_at, e.created_at) DESC`,
			[req.userId]
		);

		const conversations = result.rows.map((row) => ({
			...row,
			last_body: row.last_body != null ? decryptText(row.last_body) : row.last_body,
		}));
		return res.json({ success: true, conversations });
	} catch (err) {
		return next(err);
	}
}

async function listLearning(req, res, next) {
	try {
		const result = await query(
			`SELECT e.id,
			        e.requester_id,
			        e.owner_id,
			        e.skill_offered_id,
			        e.skill_requested_id,
			        CASE
			          WHEN e.status = 'accepted'
			            AND e.completed_by_requester_at IS NOT NULL
			            AND e.completed_by_owner_at IS NOT NULL
			          THEN 'completed'
			          ELSE e.status
			        END AS status,
			        e.completed_by_requester_at,
			        e.completed_by_owner_at,
			        e.completed_at,
			        e.message,
			        e.created_at,
			        ru.name AS requester_name,
			        ou.name AS owner_name,
			        sr.title AS requested_title,
			        sr.description AS requested_description,
			        so.title AS offered_title,
			        so.description AS offered_description,
			        owner_fb.rating AS owner_feedback_rating,
			        owner_fb.comment AS owner_feedback_comment,
			        owner_fb.created_at AS owner_feedback_at
			 FROM exchanges e
			 JOIN users ru ON ru.id = e.requester_id
			 JOIN users ou ON ou.id = e.owner_id
			 LEFT JOIN skills sr ON sr.id = e.skill_requested_id
			 LEFT JOIN skills so ON so.id = e.skill_offered_id
			 LEFT JOIN exchange_feedback owner_fb
			   ON owner_fb.exchange_id = e.id
			  AND owner_fb.from_user_id = e.owner_id
			  AND owner_fb.to_user_id = e.requester_id
			 WHERE (e.requester_id = $1 OR e.owner_id = $1)
		   AND e.status IN ('accepted','completed')
			 ORDER BY e.created_at DESC`,
			[req.userId]
		);

		return res.json({
			success: true,
			learning: result.rows.map((row) => ({
				...row,
				message: decryptText(row.message),
				owner_feedback_comment:
					row.owner_feedback_comment != null ? decryptText(row.owner_feedback_comment) : row.owner_feedback_comment,
			})),
		});
	} catch (err) {
		return next(err);
	}
}

async function listTeaching(req, res, next) {
	try {
		const result = await query(
			`SELECT e.id,
			        e.requester_id,
			        e.owner_id,
			        e.skill_offered_id,
			        e.skill_requested_id,
			        CASE
			          WHEN e.status = 'accepted'
			            AND e.completed_by_requester_at IS NOT NULL
			            AND e.completed_by_owner_at IS NOT NULL
			          THEN 'completed'
			          ELSE e.status
			        END AS status,
			        e.completed_by_requester_at,
			        e.completed_by_owner_at,
			        e.completed_at,
			        e.message,
			        e.created_at,
			        ru.name AS requester_name,
			        ou.name AS owner_name,
			        sr.title AS requested_title,
			        sr.description AS requested_description,
			        so.title AS offered_title,
			        so.description AS offered_description,
			        lf.rating AS learner_feedback_rating,
			        lf.comment AS learner_feedback_comment,
			        lf.created_at AS learner_feedback_at
		 FROM exchanges e
		 JOIN users ru ON ru.id = e.requester_id
		 JOIN users ou ON ou.id = e.owner_id
		 LEFT JOIN skills sr ON sr.id = e.skill_requested_id
		 LEFT JOIN skills so ON so.id = e.skill_offered_id
		 LEFT JOIN exchange_feedback lf
		   ON lf.exchange_id = e.id
		  AND lf.from_user_id = e.requester_id
		  AND lf.to_user_id = e.owner_id
			 WHERE (e.requester_id = $1 OR e.owner_id = $1)
		   AND e.status IN ('accepted','completed')
		 ORDER BY e.created_at DESC`,
			[req.userId]
		);

		return res.json({
			success: true,
			teaching: result.rows.map((row) => ({
				...row,
				message: decryptText(row.message),
				learner_feedback_comment:
					row.learner_feedback_comment != null ? decryptText(row.learner_feedback_comment) : row.learner_feedback_comment,
			})),
		});
	} catch (err) {
		return next(err);
	}
}

async function listExchangeRequests(req, res, next) {
	try {
		const result = await query(
			`SELECT
			  e.id,
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
			  so.title AS offered_title,
			  COALESCE(
			    jsonb_agg(DISTINCT jsonb_build_object('id', eos.skill_id, 'title', os.title))
			      FILTER (WHERE eos.skill_id IS NOT NULL),
			    '[]'::jsonb
			  ) AS offered_skills,
			  COALESCE(
			    jsonb_agg(DISTINCT jsonb_build_object('id', eis.skill_id, 'title', is2.title))
			      FILTER (WHERE eis.skill_id IS NOT NULL),
			    '[]'::jsonb
			  ) AS interested_skills
			FROM exchanges e
			JOIN users ru ON ru.id = e.requester_id
			JOIN users ou ON ou.id = e.owner_id
			LEFT JOIN skills sr ON sr.id = e.skill_requested_id
			LEFT JOIN skills so ON so.id = e.skill_offered_id
			LEFT JOIN exchange_offered_skills eos ON eos.exchange_id = e.id
			LEFT JOIN skills os ON os.id = eos.skill_id
			LEFT JOIN exchange_interested_skills eis ON eis.exchange_id = e.id
			LEFT JOIN skills is2 ON is2.id = eis.skill_id
			WHERE e.requester_id = $1 OR e.owner_id = $1
			GROUP BY
			  e.id,
			  ru.name,
			  ou.name,
			  sr.title,
			  so.title
			ORDER BY e.created_at DESC`,
			[req.userId]
		);
		return res.json({
			success: true,
			requests: result.rows.map((row) => ({
				...row,
				message: decryptText(row.message),
			})),
		});
	} catch (err) {
		return next(err);
	}
}

async function createExchangeRequest(req, res, next) {
	try {
		const { owner, receiver, skillOffered, skillRequested, offeredSkills, interestedSkills, message } = req.body || {};
		const receiverRaw = receiver ?? owner;
		if (!receiverRaw) {
			return res.status(400).json({ success: false, message: 'receiver is required' });
		}

		const ownerId = Number(receiverRaw);
		if (!Number.isInteger(ownerId) || ownerId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid receiver' });
		}

		if (String(ownerId) === String(req.userId)) {
			return res.status(400).json({ success: false, message: 'You cannot request your own skill' });
		}

		// Flexible negotiation: requester can offer multiple of their skills, and can express
		// interest in multiple of receiver's skills. Final pairing is chosen on acceptance.
		let offeredSkillIds = Array.isArray(offeredSkills) ? offeredSkills : null;
		let interestedSkillIds = Array.isArray(interestedSkills) ? interestedSkills : null;

		// Backward-compat: accept old single-skill payload (skillOffered/skillRequested)
		if (!offeredSkillIds && skillOffered != null) offeredSkillIds = [skillOffered];
		if (!interestedSkillIds && skillRequested != null) interestedSkillIds = [skillRequested];

		offeredSkillIds = (offeredSkillIds || []).map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0);
		interestedSkillIds = (interestedSkillIds || []).map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0);

		offeredSkillIds = Array.from(new Set(offeredSkillIds));
		interestedSkillIds = Array.from(new Set(interestedSkillIds));

		if (!offeredSkillIds.length) {
			return res.status(400).json({ success: false, message: 'offeredSkills is required' });
		}
		if (!interestedSkillIds.length) {
			return res.status(400).json({ success: false, message: 'interestedSkills is required' });
		}

		// Validate receiver skills exist and belong to receiver.
		const interestedRows = await query(
			`SELECT id, user_id
			 FROM skills
			 WHERE id = ANY($1::bigint[])`,
			[interestedSkillIds]
		);
		if (interestedRows.rows.length !== interestedSkillIds.length) {
			return res.status(404).json({ success: false, message: 'One or more interested skills were not found' });
		}
		for (const s of interestedRows.rows) {
			if (String(s.user_id) !== String(ownerId)) {
				return res.status(400).json({ success: false, message: 'Interested skills must belong to receiver' });
			}
		}

		// Validate offered skills exist and belong to requester.
		const offeredRows = await query(
			`SELECT id, user_id
			 FROM skills
			 WHERE id = ANY($1::bigint[])`,
			[offeredSkillIds]
		);
		if (offeredRows.rows.length !== offeredSkillIds.length) {
			return res.status(404).json({ success: false, message: 'One or more offered skills were not found' });
		}
		for (const s of offeredRows.rows) {
			if (String(s.user_id) !== String(req.userId)) {
				return res.status(400).json({ success: false, message: 'Offered skills must be yours' });
			}
		}

		const dup = await query(
			`SELECT id, status
			 FROM exchanges
			 WHERE requester_id = $1
			   AND owner_id = $2
			   AND status IN ('pending','accepted','completed')
			 LIMIT 1`,
			[req.userId, ownerId]
		);
		if (dup.rows[0]) {
			return res
				.status(409)
				.json({ success: false, message: `An exchange request already exists (${dup.rows[0].status})` });
		}

		const created = await query(
			'INSERT INTO exchanges(requester_id, owner_id, message) VALUES ($1, $2, $3) RETURNING *',
			[req.userId, ownerId, message ? encryptText(String(message)) : '']
		);
		const exchange = created.rows[0];

		await query(
			`INSERT INTO exchange_offered_skills(exchange_id, skill_id)
			 SELECT $1, unnest($2::bigint[])
			 ON CONFLICT DO NOTHING`,
			[exchange.id, offeredSkillIds]
		);
		await query(
			`INSERT INTO exchange_interested_skills(exchange_id, skill_id)
			 SELECT $1, unnest($2::bigint[])
			 ON CONFLICT DO NOTHING`,
			[exchange.id, interestedSkillIds]
		);

		return res.status(201).json({
			success: true,
			request: {
				...exchange,
				message: decryptText(exchange.message),
				offered_skills: offeredSkillIds,
				interested_skills: interestedSkillIds,
			},
		});
	} catch (err) {
		return next(err);
	}
}

async function respondToExchangeRequest(req, res, next) {
	try {
		const { status, skillOffered, skillRequested } = req.body || {};
		if (!['accepted', 'rejected', 'cancelled'].includes(status)) {
			return res.status(400).json({ success: false, message: 'Invalid status' });
		}

		const existing = await query('SELECT * FROM exchanges WHERE id = $1', [req.params.id]);
		const ex = existing.rows[0];
		if (!ex) return res.status(404).json({ success: false, message: 'Request not found' });

		if (String(ex.owner_id) !== String(req.userId) && String(ex.requester_id) !== String(req.userId)) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}

		if (ex.status !== 'pending') {
			return res.status(400).json({ success: false, message: 'Only pending requests can be updated' });
		}

		const me = String(req.userId);
		if ((status === 'accepted' || status === 'rejected') && String(ex.owner_id) !== me) {
			return res.status(403).json({ success: false, message: 'Only the skill owner can accept/reject' });
		}

		if (status === 'cancelled' && String(ex.requester_id) !== me) {
			return res.status(403).json({ success: false, message: 'Only the requester can cancel' });
		}

		if (status === 'accepted') {
			const offeredId = Number(skillOffered);
			const requestedId = Number(skillRequested);
			if (!Number.isInteger(offeredId) || offeredId <= 0) {
				return res.status(400).json({ success: false, message: 'skillOffered is required to accept' });
			}
			if (!Number.isInteger(requestedId) || requestedId <= 0) {
				return res.status(400).json({ success: false, message: 'skillRequested is required to accept' });
			}

			const offeredOk = await query(
				'SELECT 1 FROM exchange_offered_skills WHERE exchange_id = $1 AND skill_id = $2',
				[req.params.id, offeredId]
			);
			if (!offeredOk.rows[0]) {
				return res.status(400).json({ success: false, message: 'skillOffered must be one of the offeredSkills' });
			}

			const requestedOk = await query(
				'SELECT 1 FROM exchange_interested_skills WHERE exchange_id = $1 AND skill_id = $2',
				[req.params.id, requestedId]
			);
			if (!requestedOk.rows[0]) {
				return res
					.status(400)
					.json({ success: false, message: 'skillRequested must be one of the interestedSkills' });
			}

			const updated = await query(
				'UPDATE exchanges SET status = $1, skill_offered_id = $2, skill_requested_id = $3 WHERE id = $4 RETURNING *',
				[status, offeredId, requestedId, req.params.id]
			);
			const row = updated.rows[0];
			return res.json({ success: true, request: { ...row, message: decryptText(row.message) } });
		}

		const updated = await query('UPDATE exchanges SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
		const row = updated.rows[0];
		return res.json({ success: true, request: { ...row, message: decryptText(row.message) } });
	} catch (err) {
		return next(err);
	}
}

async function completeExchange(req, res, next) {
	try {
		const existing = await query('SELECT * FROM exchanges WHERE id = $1', [req.params.id]);
		const ex = existing.rows[0];
		if (!ex) return res.status(404).json({ success: false, message: 'Exchange not found' });

		const me = String(req.userId);
		if (String(ex.owner_id) !== me && String(ex.requester_id) !== me) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}

		if (ex.status === 'completed') {
			return res.json({ success: true, exchange: ex });
		}

		if (ex.status !== 'accepted') {
			return res.status(400).json({ success: false, message: 'Only accepted exchanges can be completed' });
		}

		const requesterConfirm = String(ex.requester_id) === me;
		const ownerConfirm = String(ex.owner_id) === me;

		await query('BEGIN');
		try {
			const updated = await query(
				`UPDATE exchanges
				SET
					completed_by_requester_at = CASE
						WHEN $2::boolean AND completed_by_requester_at IS NULL THEN NOW()
						ELSE completed_by_requester_at
					END,
					completed_by_owner_at = CASE
						WHEN $3::boolean AND completed_by_owner_at IS NULL THEN NOW()
						ELSE completed_by_owner_at
					END
				WHERE id = $1
				RETURNING *`,
				[req.params.id, requesterConfirm, ownerConfirm]
			);

			const completed = await query(
				`UPDATE exchanges
				SET
					status = 'completed',
					completed_at = COALESCE(completed_at, NOW())
				WHERE id = $1
					AND status = 'accepted'
					AND completed_by_requester_at IS NOT NULL
					AND completed_by_owner_at IS NOT NULL
				RETURNING *`,
				[req.params.id]
			);

			await query('COMMIT');
			return res.json({ success: true, exchange: completed.rows[0] || updated.rows[0] });
		} catch (err) {
			await query('ROLLBACK');
			throw err;
		}
	} catch (err) {
		return next(err);
	}
}

async function listExchangeMessages(req, res, next) {
	try {
		const existing = await query('SELECT id, requester_id, owner_id, status FROM exchanges WHERE id = $1', [req.params.id]);
		const ex = existing.rows[0];
		if (!ex) return res.status(404).json({ success: false, message: 'Exchange not found' });

		const me = String(req.userId);
		if (String(ex.owner_id) !== me && String(ex.requester_id) !== me) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}

		if (!['accepted', 'completed'].includes(ex.status)) {
			return res.status(400).json({ success: false, message: 'Chat is available after acceptance' });
		}

		const limitRaw = req.query.limit;
		const offsetRaw = req.query.offset;
		const limit = Math.min(Math.max(Number(limitRaw || 30), 1), 50);
		const offset = Math.max(Number(offsetRaw || 0), 0);

		const rowsResult = await query(
			`SELECT
			  m.id,
			  m.exchange_id,
			  m.from_user_id,
			  u.name AS from_name,
			  m.to_user_id,
			  m.body,
			  m.delivered_at,
			  m.read_at,
			  m.created_at,
			  COALESCE(
			    jsonb_agg(DISTINCT jsonb_build_object(
			      'id', a.id,
			      'url', a.url,
			      'mime_type', a.mime_type,
			      'original_name', a.original_name,
			      'size_bytes', a.size_bytes
			    )) FILTER (WHERE a.id IS NOT NULL),
			    '[]'::jsonb
			  ) AS attachments,
			  COALESCE(
			    jsonb_agg(DISTINCT jsonb_build_object(
			      'emoji', r.emoji,
			      'user_id', r.user_id
			    )) FILTER (WHERE r.emoji IS NOT NULL),
			    '[]'::jsonb
			  ) AS reactions
			FROM exchange_messages m
			JOIN users u ON u.id = m.from_user_id
			LEFT JOIN exchange_message_attachments a ON a.message_id = m.id
			LEFT JOIN exchange_message_reactions r ON r.message_id = m.id
			WHERE m.exchange_id = $1
			GROUP BY m.id, u.name
			ORDER BY m.created_at ASC
			LIMIT $2 OFFSET $3`,
			[req.params.id, limit, offset]
		);

		const countResult = await query(
			`SELECT COUNT(*)::int AS count
			 FROM exchange_messages
			 WHERE exchange_id = $1`,
			[req.params.id]
		);

		return res.json({
			success: true,
			messages: rowsResult.rows.map((m) => ({
				...m,
				body: decryptText(m.body),
				attachments: Array.isArray(m.attachments)
					? m.attachments.map((a) => ({
						...a,
						original_name:
							a?.original_name != null ? decryptText(a.original_name) : a?.original_name,
					}))
					: m.attachments,
			})),
			pagination: { limit, offset, total: countResult.rows[0]?.count ?? 0 },
		});
	} catch (err) {
		return next(err);
	}
}

async function markExchangeRead(req, res, next) {
	try {
		const existing = await query('SELECT id, requester_id, owner_id, status FROM exchanges WHERE id = $1', [req.params.id]);
		const ex = existing.rows[0];
		if (!ex) return res.status(404).json({ success: false, message: 'Exchange not found' });

		const me = String(req.userId);
		if (String(ex.owner_id) !== me && String(ex.requester_id) !== me) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}

		if (!['accepted', 'completed'].includes(ex.status)) {
			return res.status(400).json({ success: false, message: 'Chat is available after acceptance' });
		}

		const updated = await query(
			`UPDATE exchange_messages
			 SET read_at = COALESCE(read_at, NOW())
			 WHERE exchange_id = $1
			   AND to_user_id = $2
			   AND read_at IS NULL`,
			[req.params.id, req.userId]
		);

		return res.json({ success: true, markedRead: updated.rowCount ?? 0 });
	} catch (err) {
		return next(err);
	}
}

async function sendExchangeMessage(req, res, next) {
	try {
		const { body } = req.body || {};
		const text = String(body || '').trim();
		if (!text) return res.status(400).json({ success: false, message: 'body is required' });
		if (text.length > 2000) return res.status(400).json({ success: false, message: 'body is too long' });

		const existing = await query('SELECT id, requester_id, owner_id, status FROM exchanges WHERE id = $1', [req.params.id]);
		const ex = existing.rows[0];
		if (!ex) return res.status(404).json({ success: false, message: 'Exchange not found' });

		const me = String(req.userId);
		if (String(ex.owner_id) !== me && String(ex.requester_id) !== me) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}

		if (!['accepted', 'completed'].includes(ex.status)) {
			return res.status(400).json({ success: false, message: 'Chat is available after acceptance' });
		}

		if (ex.status !== 'accepted') {
			return res.status(400).json({ success: false, message: 'Chat is disabled after completion' });
		}

		const toUserId = String(ex.owner_id) === me ? ex.requester_id : ex.owner_id;

		const result = await query(
			`INSERT INTO exchange_messages(exchange_id, from_user_id, to_user_id, body, delivered_at)
			 VALUES ($1, $2, $3, $4, NOW())
			 RETURNING id, exchange_id, from_user_id, to_user_id, body, delivered_at, read_at, created_at`,
			[req.params.id, req.userId, toUserId, encryptText(text)]
		);
		const msg = result.rows[0];
		return res.status(201).json({
			success: true,
			message: { ...msg, body: decryptText(msg.body) },
		});
	} catch (err) {
		return next(err);
	}
}

async function sendExchangeAttachmentMessage(req, res, next) {
	try {
		const file = req.file;
		const text = String(req.body?.body || '').trim();
		if (!file) return res.status(400).json({ success: false, message: 'file is required' });
		if (text.length > 2000) return res.status(400).json({ success: false, message: 'body is too long' });

		const existing = await query('SELECT id, requester_id, owner_id, status FROM exchanges WHERE id = $1', [req.params.id]);
		const ex = existing.rows[0];
		if (!ex) return res.status(404).json({ success: false, message: 'Exchange not found' });

		const me = String(req.userId);
		if (String(ex.owner_id) !== me && String(ex.requester_id) !== me) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}
		if (!['accepted', 'completed'].includes(ex.status)) {
			return res.status(400).json({ success: false, message: 'Chat is available after acceptance' });
		}
		if (ex.status !== 'accepted') {
			return res.status(400).json({ success: false, message: 'Chat is disabled after completion' });
		}

		const toUserId = String(ex.owner_id) === me ? ex.requester_id : ex.owner_id;
		const url = `/uploads/${file.filename}`;

		const createdMsg = await query(
			`INSERT INTO exchange_messages(exchange_id, from_user_id, to_user_id, body, delivered_at)
			 VALUES ($1, $2, $3, $4, NOW())
			 RETURNING id, exchange_id, from_user_id, to_user_id, body, delivered_at, read_at, created_at`,
			[req.params.id, req.userId, toUserId, text ? encryptText(text) : '',]
		);
		const msg = createdMsg.rows[0];

		await query(
			`INSERT INTO exchange_message_attachments(message_id, url, mime_type, original_name, size_bytes)
			 VALUES ($1, $2, $3, $4, $5)`,
			[msg.id, url, file.mimetype || '', file.originalname ? encryptText(String(file.originalname)) : '', Number(file.size || 0)]
		);

		return res.status(201).json({
			success: true,
			message: { ...msg, body: msg.body ? decryptText(msg.body) : msg.body },
		});
	} catch (err) {
		return next(err);
	}
}

async function toggleMessageReaction(req, res, next) {
	try {
		const emoji = String(req.body?.emoji || '').trim();
		if (!emoji || emoji.length > 16) {
			return res.status(400).json({ success: false, message: 'emoji is required' });
		}

		const existing = await query('SELECT id, requester_id, owner_id, status FROM exchanges WHERE id = $1', [req.params.id]);
		const ex = existing.rows[0];
		if (!ex) return res.status(404).json({ success: false, message: 'Exchange not found' });

		const me = String(req.userId);
		if (String(ex.owner_id) !== me && String(ex.requester_id) !== me) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}

		if (ex.status !== 'accepted') {
			return res.status(400).json({ success: false, message: 'Reactions are disabled after completion' });
		}

		const messageId = Number(req.params.messageId);
		if (!Number.isInteger(messageId) || messageId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid message id' });
		}

		const msgRow = await query(
			'SELECT id, exchange_id FROM exchange_messages WHERE id = $1',
			[messageId]
		);
		if (!msgRow.rows[0] || String(msgRow.rows[0].exchange_id) !== String(req.params.id)) {
			return res.status(404).json({ success: false, message: 'Message not found' });
		}

		const exists = await query(
			'SELECT 1 FROM exchange_message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
			[messageId, req.userId, emoji]
		);
		if (exists.rows[0]) {
			await query(
				'DELETE FROM exchange_message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
				[messageId, req.userId, emoji]
			);
		} else {
			await query(
				'INSERT INTO exchange_message_reactions(message_id, user_id, emoji) VALUES ($1, $2, $3)',
				[messageId, req.userId, emoji]
			);
		}

		const reactions = await query(
			`SELECT emoji, user_id
			 FROM exchange_message_reactions
			 WHERE message_id = $1
			 ORDER BY created_at ASC`,
			[messageId]
		);

		return res.json({ success: true, messageId, reactions: reactions.rows });
	} catch (err) {
		return next(err);
	}
}

async function upsertExchangeFeedback(req, res, next) {
	try {
		const { rating, comment } = req.body || {};
		const numericRating = Number(rating);
		if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
			return res.status(400).json({ success: false, message: 'rating must be an integer 1-5' });
		}

		const existing = await query('SELECT * FROM exchanges WHERE id = $1', [req.params.id]);
		const ex = existing.rows[0];
		if (!ex) return res.status(404).json({ success: false, message: 'Exchange not found' });

		const me = String(req.userId);
		if (String(ex.owner_id) !== me && String(ex.requester_id) !== me) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}

		const effectivelyCompleted =
			ex.status === 'completed' ||
			(ex.status === 'accepted' && ex.completed_by_requester_at && ex.completed_by_owner_at);
		if (!effectivelyCompleted) {
			return res.status(400).json({ success: false, message: 'Feedback can be left after completion' });
		}

		if (ex.status === 'accepted' && ex.completed_by_requester_at && ex.completed_by_owner_at) {
			await query(
				`UPDATE exchanges
				 SET status = 'completed',
				     completed_at = COALESCE(completed_at, NOW())
				 WHERE id = $1
				   AND status = 'accepted'`,
				[req.params.id]
			);
		}

		const toUserId = String(ex.owner_id) === me ? ex.requester_id : ex.owner_id;
		const safeComment = comment ? encryptText(String(comment)) : '';
		const result = await query(
			`INSERT INTO exchange_feedback(exchange_id, from_user_id, to_user_id, rating, comment)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (exchange_id, from_user_id)
			 DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = NOW()
			 RETURNING *`,
			[req.params.id, req.userId, toUserId, numericRating, safeComment]
		);
		const fb = result.rows[0];
		return res.status(201).json({
			success: true,
			feedback: { ...fb, comment: decryptText(fb.comment) },
		});
	} catch (err) {
		return next(err);
	}
}

async function getExchangeFeedback(req, res, next) {
	try {
		const existing = await query('SELECT * FROM exchanges WHERE id = $1', [req.params.id]);
		const ex = existing.rows[0];
		if (!ex) return res.status(404).json({ success: false, message: 'Exchange not found' });

		const me = String(req.userId);
		if (String(ex.owner_id) !== me && String(ex.requester_id) !== me) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}

		const result = await query(
			`SELECT f.*,
			        fu.name AS from_name,
			        tu.name AS to_name
			 FROM exchange_feedback f
			 JOIN users fu ON fu.id = f.from_user_id
			 JOIN users tu ON tu.id = f.to_user_id
			 WHERE f.exchange_id = $1
			 ORDER BY f.created_at ASC`,
			[req.params.id]
		);
		return res.json({
			success: true,
			feedback: result.rows.map((row) => ({
				...row,
				comment: decryptText(row.comment),
			})),
		});
	} catch (err) {
		return next(err);
	}
}

module.exports = {
	createExchangeRequest,
	listExchangeRequests,
	respondToExchangeRequest,
	listLearning,
	listTeaching,
	completeExchange,
	listChatConversations,
	listExchangeMessages,
	sendExchangeMessage,
	sendExchangeAttachmentMessage,
	markExchangeRead,
	toggleMessageReaction,
	upsertExchangeFeedback,
	getExchangeFeedback,
};

