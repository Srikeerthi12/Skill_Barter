const Exchange = require('../models/exchange.model');
const Skill = require('../models/skill.model');
const User = require('../models/user.model');
const ExchangeMessage = require('../models/exchangeMessage.model');
const ExchangeFeedback = require('../models/exchangeFeedback.model');
const { nextId } = require('../utils/sequence');
const { encryptText, decryptText } = require('../utils/secureText');

function toInt(value) {
	const n = Number(value);
	return Number.isInteger(n) ? n : null;
}

function effectiveStatus(exchange) {
	if (!exchange) return null;
	if (
		exchange.status === 'accepted' &&
		exchange.completed_by_requester_at != null &&
		exchange.completed_by_owner_at != null
	) {
		return 'completed';
	}
	return exchange.status;
}

async function loadUsersByIds(userIds) {
	const ids = Array.from(new Set((userIds || []).filter((v) => Number.isInteger(v) && v > 0)));
	if (!ids.length) return new Map();
	const users = await User.find({ id: { $in: ids } }).select({ id: 1, name: 1, created_at: 1 }).lean();
	return new Map(users.map((u) => [u.id, u]));
}

async function loadSkillsByIds(skillIds) {
	const ids = Array.from(new Set((skillIds || []).filter((v) => Number.isInteger(v) && v > 0)));
	if (!ids.length) return new Map();
	const skills = await Skill.find({ id: { $in: ids } }).select({ id: 1, user_id: 1, title: 1, description: 1 }).lean();
	return new Map(skills.map((s) => [s.id, s]));
}

function requireParticipant(exchange, userId) {
	return String(exchange.owner_id) === String(userId) || String(exchange.requester_id) === String(userId);
}

async function listChatConversations(req, res, next) {
	try {
		const me = toInt(req.userId);
		if (!me) return res.status(401).json({ success: false, message: 'Unauthorized' });

		const exchanges = await Exchange.find({
			$and: [{ status: { $in: ['accepted', 'completed'] } }, { $or: [{ requester_id: me }, { owner_id: me }] }],
		})
			.sort({ created_at: -1 })
			.lean();

		const exchangeIds = exchanges.map((e) => e.id);
		if (!exchangeIds.length) return res.json({ success: true, conversations: [] });

		const usersById = await loadUsersByIds(exchanges.flatMap((e) => [e.requester_id, e.owner_id]));
		const skillsById = await loadSkillsByIds(exchanges.flatMap((e) => [e.skill_requested_id, e.skill_offered_id]));

		const lastMessages = await ExchangeMessage.aggregate([
			{ $match: { exchange_id: { $in: exchangeIds } } },
			{ $sort: { created_at: -1 } },
			{ $group: { _id: '$exchange_id', body: { $first: '$body' }, created_at: { $first: '$created_at' } } },
		]);
		const lastByExchange = new Map(lastMessages.map((m) => [m._id, m]));

		const unreadAgg = await ExchangeMessage.aggregate([
			{ $match: { exchange_id: { $in: exchangeIds }, to_user_id: me, read_at: null } },
			{ $group: { _id: '$exchange_id', count: { $sum: 1 } } },
		]);
		const unreadByExchange = new Map(unreadAgg.map((r) => [r._id, r.count]));

		const conversations = exchanges
			.map((e) => {
				const ru = usersById.get(e.requester_id);
				const ou = usersById.get(e.owner_id);
				const sr = skillsById.get(e.skill_requested_id);
				const so = skillsById.get(e.skill_offered_id);
				const other_user_id = e.requester_id === me ? e.owner_id : e.requester_id;
				const other = usersById.get(other_user_id);
				const last = lastByExchange.get(e.id);
				return {
					id: e.id,
					status: effectiveStatus(e),
					requester_id: e.requester_id,
					owner_id: e.owner_id,
					requester_name: ru?.name || '',
					owner_name: ou?.name || '',
					requested_title: sr?.title || null,
					offered_title: so?.title || null,
					other_user_id,
					other_user_name: other?.name || '',
					last_body: last?.body != null ? decryptText(last.body) : null,
					last_at: last?.created_at || null,
					unread_count: unreadByExchange.get(e.id) || 0,
					created_at: e.created_at,
				};
			})
			.sort((a, b) => {
				const aTime = a.last_at ? new Date(a.last_at).getTime() : new Date(a.created_at).getTime();
				const bTime = b.last_at ? new Date(b.last_at).getTime() : new Date(b.created_at).getTime();
				return bTime - aTime;
			});

		return res.json({ success: true, conversations });
	} catch (err) {
		return next(err);
	}
}

async function listLearning(req, res, next) {
	try {
		const me = toInt(req.userId);
		if (!me) return res.status(401).json({ success: false, message: 'Unauthorized' });

		const exchanges = await Exchange.find({
			$and: [{ status: { $in: ['accepted', 'completed'] } }, { $or: [{ requester_id: me }, { owner_id: me }] }],
		})
			.sort({ created_at: -1 })
			.lean();

		const usersById = await loadUsersByIds(exchanges.flatMap((e) => [e.requester_id, e.owner_id]));
		const skillsById = await loadSkillsByIds(exchanges.flatMap((e) => [e.skill_requested_id, e.skill_offered_id]));

		const exchangeIds = exchanges.map((e) => e.id);
		const feedback = exchangeIds.length
			? await ExchangeFeedback.find({ exchange_id: { $in: exchangeIds } })
					.select({ exchange_id: 1, from_user_id: 1, to_user_id: 1, rating: 1, comment: 1, created_at: 1 })
					.lean()
			: [];

		const ownerFbByExchange = new Map();
		for (const fb of feedback) {
			const ex = exchanges.find((e) => e.id === fb.exchange_id);
			if (!ex) continue;
			if (fb.from_user_id === ex.owner_id && fb.to_user_id === ex.requester_id) {
				ownerFbByExchange.set(ex.id, fb);
			}
		}

		return res.json({
			success: true,
			learning: exchanges.map((e) => {
				const ru = usersById.get(e.requester_id);
				const ou = usersById.get(e.owner_id);
				const sr = skillsById.get(e.skill_requested_id);
				const so = skillsById.get(e.skill_offered_id);
				const ownerFb = ownerFbByExchange.get(e.id) || null;
				return {
					id: e.id,
					requester_id: e.requester_id,
					owner_id: e.owner_id,
					skill_offered_id: e.skill_offered_id,
					skill_requested_id: e.skill_requested_id,
					status: effectiveStatus(e),
					completed_by_requester_at: e.completed_by_requester_at,
					completed_by_owner_at: e.completed_by_owner_at,
					completed_at: e.completed_at,
					message: decryptText(e.message),
					created_at: e.created_at,
					requester_name: ru?.name || '',
					owner_name: ou?.name || '',
					requested_title: sr?.title || null,
					requested_description: sr?.description || null,
					offered_title: so?.title || null,
					offered_description: so?.description || null,
					owner_feedback_rating: ownerFb?.rating ?? null,
					owner_feedback_comment: ownerFb?.comment != null ? decryptText(ownerFb.comment) : null,
					owner_feedback_at: ownerFb?.created_at ?? null,
				};
			}),
		});
	} catch (err) {
		return next(err);
	}
}

async function listTeaching(req, res, next) {
	try {
		const me = toInt(req.userId);
		if (!me) return res.status(401).json({ success: false, message: 'Unauthorized' });

		const exchanges = await Exchange.find({
			$and: [{ status: { $in: ['accepted', 'completed'] } }, { $or: [{ requester_id: me }, { owner_id: me }] }],
		})
			.sort({ created_at: -1 })
			.lean();

		const usersById = await loadUsersByIds(exchanges.flatMap((e) => [e.requester_id, e.owner_id]));
		const skillsById = await loadSkillsByIds(exchanges.flatMap((e) => [e.skill_requested_id, e.skill_offered_id]));

		const exchangeIds = exchanges.map((e) => e.id);
		const feedback = exchangeIds.length
			? await ExchangeFeedback.find({ exchange_id: { $in: exchangeIds } })
					.select({ exchange_id: 1, from_user_id: 1, to_user_id: 1, rating: 1, comment: 1, created_at: 1 })
					.lean()
			: [];

		const learnerFbByExchange = new Map();
		for (const fb of feedback) {
			const ex = exchanges.find((e) => e.id === fb.exchange_id);
			if (!ex) continue;
			if (fb.from_user_id === ex.requester_id && fb.to_user_id === ex.owner_id) {
				learnerFbByExchange.set(ex.id, fb);
			}
		}

		return res.json({
			success: true,
			teaching: exchanges.map((e) => {
				const ru = usersById.get(e.requester_id);
				const ou = usersById.get(e.owner_id);
				const sr = skillsById.get(e.skill_requested_id);
				const so = skillsById.get(e.skill_offered_id);
				const learnerFb = learnerFbByExchange.get(e.id) || null;
				return {
					id: e.id,
					requester_id: e.requester_id,
					owner_id: e.owner_id,
					skill_offered_id: e.skill_offered_id,
					skill_requested_id: e.skill_requested_id,
					status: effectiveStatus(e),
					completed_by_requester_at: e.completed_by_requester_at,
					completed_by_owner_at: e.completed_by_owner_at,
					completed_at: e.completed_at,
					message: decryptText(e.message),
					created_at: e.created_at,
					requester_name: ru?.name || '',
					owner_name: ou?.name || '',
					requested_title: sr?.title || null,
					requested_description: sr?.description || null,
					offered_title: so?.title || null,
					offered_description: so?.description || null,
					learner_feedback_rating: learnerFb?.rating ?? null,
					learner_feedback_comment: learnerFb?.comment != null ? decryptText(learnerFb.comment) : null,
					learner_feedback_at: learnerFb?.created_at ?? null,
				};
			}),
		});
	} catch (err) {
		return next(err);
	}
}

async function listExchangeRequests(req, res, next) {
	try {
		const me = toInt(req.userId);
		if (!me) return res.status(401).json({ success: false, message: 'Unauthorized' });

		const exchanges = await Exchange.find({ $or: [{ requester_id: me }, { owner_id: me }] })
			.sort({ created_at: -1 })
			.lean();

		const usersById = await loadUsersByIds(exchanges.flatMap((e) => [e.requester_id, e.owner_id]));
		const skillIds = exchanges.flatMap((e) => [
			e.skill_requested_id,
			e.skill_offered_id,
			...(e.offered_skills || []),
			...(e.interested_skills || []),
		]);
		const skillsById = await loadSkillsByIds(skillIds);

		const requests = exchanges.map((e) => {
			const ru = usersById.get(e.requester_id);
			const ou = usersById.get(e.owner_id);
			const sr = skillsById.get(e.skill_requested_id);
			const so = skillsById.get(e.skill_offered_id);

			const offered_skills = (e.offered_skills || [])
				.map((id) => skillsById.get(id))
				.filter(Boolean)
				.map((s) => ({ id: s.id, title: s.title }));
			const interested_skills = (e.interested_skills || [])
				.map((id) => skillsById.get(id))
				.filter(Boolean)
				.map((s) => ({ id: s.id, title: s.title }));

			return {
				id: e.id,
				requester_id: e.requester_id,
				owner_id: e.owner_id,
				skill_offered_id: e.skill_offered_id,
				skill_requested_id: e.skill_requested_id,
				status: e.status,
				message: decryptText(e.message),
				created_at: e.created_at,
				requester_name: ru?.name || '',
				owner_name: ou?.name || '',
				requested_title: sr?.title || null,
				offered_title: so?.title || null,
				offered_skills,
				interested_skills,
			};
		});

		return res.json({ success: true, requests });
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

		const ownerId = toInt(receiverRaw);
		if (!ownerId || ownerId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid receiver' });
		}

		if (String(ownerId) === String(req.userId)) {
			return res.status(400).json({ success: false, message: 'You cannot request your own skill' });
		}

		let offeredSkillIds = Array.isArray(offeredSkills) ? offeredSkills : null;
		let interestedSkillIds = Array.isArray(interestedSkills) ? interestedSkills : null;

		if (!offeredSkillIds && skillOffered != null) offeredSkillIds = [skillOffered];
		if (!interestedSkillIds && skillRequested != null) interestedSkillIds = [skillRequested];

		offeredSkillIds = (offeredSkillIds || []).map((v) => toInt(v)).filter((v) => Number.isInteger(v) && v > 0);
		interestedSkillIds = (interestedSkillIds || []).map((v) => toInt(v)).filter((v) => Number.isInteger(v) && v > 0);
		offeredSkillIds = Array.from(new Set(offeredSkillIds));
		interestedSkillIds = Array.from(new Set(interestedSkillIds));

		if (!offeredSkillIds.length) {
			return res.status(400).json({ success: false, message: 'offeredSkills is required' });
		}
		if (!interestedSkillIds.length) {
			return res.status(400).json({ success: false, message: 'interestedSkills is required' });
		}

		const interestedDocs = await Skill.find({ id: { $in: interestedSkillIds } }).select({ id: 1, user_id: 1 }).lean();
		if (interestedDocs.length !== interestedSkillIds.length) {
			return res.status(404).json({ success: false, message: 'One or more interested skills were not found' });
		}
		for (const s of interestedDocs) {
			if (String(s.user_id) !== String(ownerId)) {
				return res.status(400).json({ success: false, message: 'Interested skills must belong to receiver' });
			}
		}

		const offeredDocs = await Skill.find({ id: { $in: offeredSkillIds } }).select({ id: 1, user_id: 1 }).lean();
		if (offeredDocs.length !== offeredSkillIds.length) {
			return res.status(404).json({ success: false, message: 'One or more offered skills were not found' });
		}
		for (const s of offeredDocs) {
			if (String(s.user_id) !== String(req.userId)) {
				return res.status(400).json({ success: false, message: 'Offered skills must be yours' });
			}
		}

		const dup = await Exchange.findOne({
			requester_id: toInt(req.userId),
			owner_id: ownerId,
			status: { $in: ['pending', 'accepted', 'completed'] },
		})
			.select({ id: 1, status: 1 })
			.lean();
		if (dup) {
			return res
				.status(409)
				.json({ success: false, message: `An exchange request already exists (${dup.status})` });
		}

		const exchange = await Exchange.create({
			id: await nextId('exchanges'),
			requester_id: toInt(req.userId),
			owner_id: ownerId,
			message: message ? encryptText(String(message)) : '',
			offered_skills: offeredSkillIds,
			interested_skills: interestedSkillIds,
			status: 'pending',
		});

		return res.status(201).json({
			success: true,
			request: {
				id: exchange.id,
				requester_id: exchange.requester_id,
				owner_id: exchange.owner_id,
				status: exchange.status,
				message: decryptText(exchange.message),
				created_at: exchange.created_at,
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

		const exchangeId = toInt(req.params.id);
		if (!exchangeId || exchangeId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid exchange id' });
		}

		const ex = await Exchange.findOne({ id: exchangeId }).lean();
		if (!ex) return res.status(404).json({ success: false, message: 'Request not found' });

		if (!requireParticipant(ex, req.userId)) {
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
			const offeredId = toInt(skillOffered);
			const requestedId = toInt(skillRequested);
			if (!offeredId || offeredId <= 0) {
				return res.status(400).json({ success: false, message: 'skillOffered is required to accept' });
			}
			if (!requestedId || requestedId <= 0) {
				return res.status(400).json({ success: false, message: 'skillRequested is required to accept' });
			}

			if (!(ex.offered_skills || []).includes(offeredId)) {
				return res.status(400).json({ success: false, message: 'skillOffered must be one of the offeredSkills' });
			}
			if (!(ex.interested_skills || []).includes(requestedId)) {
				return res
					.status(400)
					.json({ success: false, message: 'skillRequested must be one of the interestedSkills' });
			}

			const row = await Exchange.findOneAndUpdate(
				{ id: exchangeId },
				{ $set: { status: 'accepted', skill_offered_id: offeredId, skill_requested_id: requestedId } },
				{ new: true }
			).lean();

			return res.json({ success: true, request: { ...row, message: decryptText(row.message) } });
		}

		const row = await Exchange.findOneAndUpdate({ id: exchangeId }, { $set: { status } }, { new: true }).lean();
		return res.json({ success: true, request: { ...row, message: decryptText(row.message) } });
	} catch (err) {
		return next(err);
	}
}

async function completeExchange(req, res, next) {
	try {
		const exchangeId = toInt(req.params.id);
		if (!exchangeId || exchangeId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid exchange id' });
		}

		const ex = await Exchange.findOne({ id: exchangeId }).lean();
		if (!ex) return res.status(404).json({ success: false, message: 'Exchange not found' });

		const me = String(req.userId);
		if (!requireParticipant(ex, me)) {
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
		const now = new Date();

		const set = {};
		if (requesterConfirm && !ex.completed_by_requester_at) set.completed_by_requester_at = now;
		if (ownerConfirm && !ex.completed_by_owner_at) set.completed_by_owner_at = now;

		const updated = await Exchange.findOneAndUpdate({ id: exchangeId }, { $set: set }, { new: true }).lean();

		if (
			updated.status === 'accepted' &&
			updated.completed_by_requester_at != null &&
			updated.completed_by_owner_at != null
		) {
			const completed = await Exchange.findOneAndUpdate(
				{ id: exchangeId, status: 'accepted' },
				{ $set: { status: 'completed', completed_at: updated.completed_at || now } },
				{ new: true }
			).lean();
			return res.json({ success: true, exchange: completed });
		}

		return res.json({ success: true, exchange: updated });
	} catch (err) {
		return next(err);
	}
}

async function listExchangeMessages(req, res, next) {
	try {
		const exchangeId = toInt(req.params.id);
		if (!exchangeId || exchangeId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid exchange id' });
		}

		const ex = await Exchange.findOne({ id: exchangeId }).select({ id: 1, requester_id: 1, owner_id: 1, status: 1 }).lean();
		if (!ex) return res.status(404).json({ success: false, message: 'Exchange not found' });
		if (!requireParticipant(ex, req.userId)) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}
		if (!['accepted', 'completed'].includes(ex.status)) {
			return res.status(400).json({ success: false, message: 'Chat is available after acceptance' });
		}

		const limitRaw = req.query.limit;
		const offsetRaw = req.query.offset;
		const limit = Math.min(Math.max(Number(limitRaw || 30), 1), 50);
		const offset = Math.max(Number(offsetRaw || 0), 0);

		const total = await ExchangeMessage.countDocuments({ exchange_id: exchangeId });
		const rows = await ExchangeMessage.find({ exchange_id: exchangeId })
			.sort({ created_at: 1 })
			.skip(offset)
			.limit(limit)
			.lean();

		const fromIds = Array.from(new Set(rows.map((m) => m.from_user_id)));
		const fromUsers = await User.find({ id: { $in: fromIds } }).select({ id: 1, name: 1 }).lean();
		const fromNameById = new Map(fromUsers.map((u) => [u.id, u.name]));

		return res.json({
			success: true,
			messages: rows.map((m) => ({
				id: m.id,
				exchange_id: m.exchange_id,
				from_user_id: m.from_user_id,
				from_name: fromNameById.get(m.from_user_id) || '',
				to_user_id: m.to_user_id,
				body: decryptText(m.body),
				delivered_at: m.delivered_at,
				read_at: m.read_at,
				created_at: m.created_at,
				attachments: (m.attachments || []).map((a) => ({
					...a,
					original_name: a?.original_name != null ? decryptText(a.original_name) : a?.original_name,
				})),
				reactions: (m.reactions || []).map((r) => ({ emoji: r.emoji, user_id: r.user_id })),
			})),
			pagination: { limit, offset, total },
		});
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

		const exchangeId = toInt(req.params.id);
		if (!exchangeId || exchangeId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid exchange id' });
		}

		const ex = await Exchange.findOne({ id: exchangeId }).select({ id: 1, requester_id: 1, owner_id: 1, status: 1 }).lean();
		if (!ex) return res.status(404).json({ success: false, message: 'Exchange not found' });
		if (!requireParticipant(ex, req.userId)) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}
		if (!['accepted', 'completed'].includes(ex.status)) {
			return res.status(400).json({ success: false, message: 'Chat is available after acceptance' });
		}
		if (ex.status !== 'accepted') {
			return res.status(400).json({ success: false, message: 'Chat is disabled after completion' });
		}

		const me = String(req.userId);
		const toUserId = String(ex.owner_id) === me ? ex.requester_id : ex.owner_id;
		const msg = await ExchangeMessage.create({
			id: await nextId('exchange_messages'),
			exchange_id: exchangeId,
			from_user_id: toInt(req.userId),
			to_user_id: toInt(toUserId),
			body: encryptText(text),
			delivered_at: new Date(),
		});

		return res.status(201).json({
			success: true,
			message: {
				id: msg.id,
				exchange_id: msg.exchange_id,
				from_user_id: msg.from_user_id,
				to_user_id: msg.to_user_id,
				body: decryptText(msg.body),
				delivered_at: msg.delivered_at,
				read_at: msg.read_at,
				created_at: msg.created_at,
			},
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

		const exchangeId = toInt(req.params.id);
		if (!exchangeId || exchangeId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid exchange id' });
		}

		const ex = await Exchange.findOne({ id: exchangeId }).select({ id: 1, requester_id: 1, owner_id: 1, status: 1 }).lean();
		if (!ex) return res.status(404).json({ success: false, message: 'Exchange not found' });
		if (!requireParticipant(ex, req.userId)) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}
		if (!['accepted', 'completed'].includes(ex.status)) {
			return res.status(400).json({ success: false, message: 'Chat is available after acceptance' });
		}
		if (ex.status !== 'accepted') {
			return res.status(400).json({ success: false, message: 'Chat is disabled after completion' });
		}

		const me = String(req.userId);
		const toUserId = String(ex.owner_id) === me ? ex.requester_id : ex.owner_id;
		const url = `/uploads/${file.filename}`;

		const msg = await ExchangeMessage.create({
			id: await nextId('exchange_messages'),
			exchange_id: exchangeId,
			from_user_id: toInt(req.userId),
			to_user_id: toInt(toUserId),
			body: text ? encryptText(text) : '',
			delivered_at: new Date(),
			attachments: [
				{
					id: await nextId('exchange_message_attachments'),
					url,
					mime_type: file.mimetype || '',
					original_name: file.originalname ? encryptText(String(file.originalname)) : '',
					size_bytes: Number(file.size || 0),
				},
			],
		});

		return res.status(201).json({
			success: true,
			message: {
				id: msg.id,
				exchange_id: msg.exchange_id,
				from_user_id: msg.from_user_id,
				to_user_id: msg.to_user_id,
				body: msg.body ? decryptText(msg.body) : msg.body,
				delivered_at: msg.delivered_at,
				read_at: msg.read_at,
				created_at: msg.created_at,
			},
		});
	} catch (err) {
		return next(err);
	}
}

async function markExchangeRead(req, res, next) {
	try {
		const exchangeId = toInt(req.params.id);
		if (!exchangeId || exchangeId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid exchange id' });
		}

		const ex = await Exchange.findOne({ id: exchangeId }).select({ id: 1, requester_id: 1, owner_id: 1, status: 1 }).lean();
		if (!ex) return res.status(404).json({ success: false, message: 'Exchange not found' });
		if (!requireParticipant(ex, req.userId)) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}
		if (!['accepted', 'completed'].includes(ex.status)) {
			return res.status(400).json({ success: false, message: 'Chat is available after acceptance' });
		}

		const me = toInt(req.userId);
		const updated = await ExchangeMessage.updateMany(
			{ exchange_id: exchangeId, to_user_id: me, read_at: null },
			{ $set: { read_at: new Date() } }
		);

		return res.json({ success: true, markedRead: updated.modifiedCount ?? 0 });
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

		const exchangeId = toInt(req.params.id);
		if (!exchangeId || exchangeId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid exchange id' });
		}

		const ex = await Exchange.findOne({ id: exchangeId }).select({ id: 1, requester_id: 1, owner_id: 1, status: 1 }).lean();
		if (!ex) return res.status(404).json({ success: false, message: 'Exchange not found' });
		if (!requireParticipant(ex, req.userId)) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}
		if (ex.status !== 'accepted') {
			return res.status(400).json({ success: false, message: 'Reactions are disabled after completion' });
		}

		const messageId = toInt(req.params.messageId);
		if (!messageId || messageId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid message id' });
		}

		const msg = await ExchangeMessage.findOne({ id: messageId }).lean();
		if (!msg || msg.exchange_id !== exchangeId) {
			return res.status(404).json({ success: false, message: 'Message not found' });
		}

		const meId = toInt(req.userId);
		const reactions = Array.isArray(msg.reactions) ? [...msg.reactions] : [];
		const idx = reactions.findIndex((r) => r.user_id === meId && r.emoji === emoji);
		if (idx >= 0) {
			reactions.splice(idx, 1);
		} else {
			reactions.push({ emoji, user_id: meId, created_at: new Date() });
		}
		reactions.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

		await ExchangeMessage.updateOne({ id: messageId }, { $set: { reactions } });

		return res.json({
			success: true,
			messageId,
			reactions: reactions.map((r) => ({ emoji: r.emoji, user_id: r.user_id })),
		});
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

		const exchangeId = toInt(req.params.id);
		if (!exchangeId || exchangeId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid exchange id' });
		}

		const ex = await Exchange.findOne({ id: exchangeId }).lean();
		if (!ex) return res.status(404).json({ success: false, message: 'Exchange not found' });
		if (!requireParticipant(ex, req.userId)) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}

		const effectivelyCompleted =
			ex.status === 'completed' ||
			(ex.status === 'accepted' && ex.completed_by_requester_at && ex.completed_by_owner_at);
		if (!effectivelyCompleted) {
			return res.status(400).json({ success: false, message: 'Feedback can be left after completion' });
		}

		if (ex.status === 'accepted' && ex.completed_by_requester_at && ex.completed_by_owner_at) {
			await Exchange.updateOne(
				{ id: exchangeId, status: 'accepted' },
				{ $set: { status: 'completed', completed_at: ex.completed_at || new Date() } }
			);
		}

		const me = String(req.userId);
		const toUserId = String(ex.owner_id) === me ? ex.requester_id : ex.owner_id;
		const meId = toInt(req.userId);
		const safeComment = comment ? encryptText(String(comment)) : '';

		let fb = await ExchangeFeedback.findOne({ exchange_id: exchangeId, from_user_id: meId }).lean();
		if (fb) {
			fb = await ExchangeFeedback.findOneAndUpdate(
				{ exchange_id: exchangeId, from_user_id: meId },
				{ $set: { rating: numericRating, comment: safeComment, to_user_id: toInt(toUserId) } },
				{ new: true }
			).lean();
		} else {
			fb = await ExchangeFeedback.create({
				id: await nextId('exchange_feedback'),
				exchange_id: exchangeId,
				from_user_id: meId,
				to_user_id: toInt(toUserId),
				rating: numericRating,
				comment: safeComment,
			});
		}

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
		const exchangeId = toInt(req.params.id);
		if (!exchangeId || exchangeId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid exchange id' });
		}

		const ex = await Exchange.findOne({ id: exchangeId }).lean();
		if (!ex) return res.status(404).json({ success: false, message: 'Exchange not found' });
		if (!requireParticipant(ex, req.userId)) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}

		const feedback = await ExchangeFeedback.find({ exchange_id: exchangeId }).sort({ created_at: 1 }).lean();
		const userIds = Array.from(new Set(feedback.flatMap((f) => [f.from_user_id, f.to_user_id])));
		const usersById = await loadUsersByIds(userIds);

		return res.json({
			success: true,
			feedback: feedback.map((row) => ({
				...row,
				from_name: usersById.get(row.from_user_id)?.name || '',
				to_name: usersById.get(row.to_user_id)?.name || '',
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
