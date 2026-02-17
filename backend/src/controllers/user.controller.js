const User = require('../models/user.model');
const Skill = require('../models/skill.model');
const Exchange = require('../models/exchange.model');
const ExchangeFeedback = require('../models/exchangeFeedback.model');
const { decryptText } = require('../utils/secureText');

function round2(value) {
	return Math.round(Number(value) * 100) / 100;
}

async function computeSkillRatingStatsForSkillIds(skillIds) {
	const ids = Array.from(new Set((skillIds || []).filter((v) => Number.isInteger(v) && v > 0)));
	if (!ids.length) return new Map();

	const exchanges = await Exchange.find({
		status: 'completed',
		$or: [{ skill_requested_id: { $in: ids } }, { skill_offered_id: { $in: ids } }],
	})
		.select({ id: 1, owner_id: 1, requester_id: 1, skill_requested_id: 1, skill_offered_id: 1 })
		.lean();

	const exchangeById = new Map(exchanges.map((e) => [e.id, e]));
	const exchangeIds = Array.from(exchangeById.keys());
	if (!exchangeIds.length) return new Map();

	const feedback = await ExchangeFeedback.find({ exchange_id: { $in: exchangeIds } })
		.select({ exchange_id: 1, rating: 1, to_user_id: 1, from_user_id: 1 })
		.lean();

	const stats = new Map();
	const idSet = new Set(ids);
	for (const fb of feedback) {
		const ex = exchangeById.get(fb.exchange_id);
		if (!ex) continue;

		let skillId = null;
		if (
			ex.skill_requested_id != null &&
			fb.to_user_id === ex.owner_id &&
			fb.from_user_id === ex.requester_id
		) {
			skillId = ex.skill_requested_id;
		} else if (
			ex.skill_offered_id != null &&
			fb.to_user_id === ex.requester_id &&
			fb.from_user_id === ex.owner_id
		) {
			skillId = ex.skill_offered_id;
		}

		if (!Number.isInteger(skillId) || !idSet.has(skillId)) continue;
		const current = stats.get(skillId) || { sum: 0, count: 0 };
		current.sum += Number(fb.rating) || 0;
		current.count += 1;
		stats.set(skillId, current);
	}

	const result = new Map();
	for (const [skillId, { sum, count }] of stats.entries()) {
		result.set(skillId, {
			average_rating: count ? round2(sum / count) : 0,
			ratings_count: count,
		});
	}
	return result;
}

async function getMyProfile(req, res, next) {
	try {
		const userId = Number(req.userId);
		if (!Number.isInteger(userId) || userId <= 0) {
			return res.status(401).json({ success: false, message: 'Unauthorized' });
		}

		const user = await User.findOne({ id: userId }).select({ id: 1, name: 1, email: 1, created_at: 1 }).lean();
		if (!user) return res.status(404).json({ success: false, message: 'User not found' });

		const skills = await Skill.find({ user_id: userId })
			.select({ id: 1, user_id: 1, title: 1, description: 1, created_at: 1 })
			.sort({ created_at: -1 })
			.lean();

		const repBySkill = await computeSkillRatingStatsForSkillIds(skills.map((s) => s.id));
		const skillsWithStats = skills.map((s) => {
			const rep = repBySkill.get(s.id) || { average_rating: 0, ratings_count: 0 };
			return {
				...s,
				skill_average_rating: rep.average_rating,
				skill_ratings_count: rep.ratings_count,
			};
		});

		const completedExchangesCount = await Exchange.countDocuments({
			status: 'completed',
			$or: [{ requester_id: userId }, { owner_id: userId }],
		});

		const repAgg = await ExchangeFeedback.aggregate([
			{ $match: { to_user_id: userId } },
			{ $group: { _id: '$to_user_id', average_rating: { $avg: '$rating' }, ratings_count: { $sum: 1 } } },
		]);
		const repRow = repAgg[0] || { average_rating: 0, ratings_count: 0 };

		return res.json({
			success: true,
			profile: {
				user,
				skills: skillsWithStats,
				completedExchangesCount,
				reputation: {
					averageRating: round2(repRow.average_rating || 0),
					ratingsCount: repRow.ratings_count || 0,
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

		const user = await User.findOne({ id: userId }).select({ id: 1, name: 1, created_at: 1 }).lean();
		if (!user) return res.status(404).json({ success: false, message: 'User not found' });

		const skills = await Skill.find({ user_id: userId })
			.select({ id: 1, user_id: 1, title: 1, description: 1, created_at: 1 })
			.sort({ created_at: -1 })
			.lean();

		const repBySkill = await computeSkillRatingStatsForSkillIds(skills.map((s) => s.id));
		const skillsWithStats = skills.map((s) => {
			const rep = repBySkill.get(s.id) || { average_rating: 0, ratings_count: 0 };
			return {
				...s,
				skill_average_rating: rep.average_rating,
				skill_ratings_count: rep.ratings_count,
			};
		});

		const completedExchangesCount = await Exchange.countDocuments({
			status: 'completed',
			$or: [{ requester_id: userId }, { owner_id: userId }],
		});

		const repAgg = await ExchangeFeedback.aggregate([
			{ $match: { to_user_id: userId } },
			{ $group: { _id: '$to_user_id', average_rating: { $avg: '$rating' }, ratings_count: { $sum: 1 } } },
		]);
		const repRow = repAgg[0] || { average_rating: 0, ratings_count: 0 };

		return res.json({
			success: true,
			profile: {
				user,
				skills: skillsWithStats,
				completedExchangesCount,
				reputation: {
					averageRating: round2(repRow.average_rating || 0),
					ratingsCount: repRow.ratings_count || 0,
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

		const feedbackAll = await ExchangeFeedback.find({ to_user_id: userId })
			.select({ id: 1, rating: 1, comment: 1, created_at: 1, from_user_id: 1, exchange_id: 1, to_user_id: 1 })
			.sort({ created_at: -1 })
			.lean();

		if (!feedbackAll.length) {
			return res.json({ success: true, reviews: [], pagination: { limit, offset, total: 0 } });
		}

		const exchangeIds = Array.from(new Set(feedbackAll.map((f) => f.exchange_id)));
		const exchanges = await Exchange.find({ id: { $in: exchangeIds }, status: 'completed' })
			.select({ id: 1, owner_id: 1, requester_id: 1, skill_requested_id: 1, skill_offered_id: 1 })
			.lean();
		const exchangeById = new Map(exchanges.map((e) => [e.id, e]));

		const filtered = feedbackAll.filter((f) => exchangeById.has(f.exchange_id));
		const total = filtered.length;
		const slice = filtered.slice(offset, offset + limit);

		const fromIds = Array.from(new Set(slice.map((r) => r.from_user_id)));
		const fromUsers = await User.find({ id: { $in: fromIds } }).select({ id: 1, name: 1 }).lean();
		const fromNameById = new Map(fromUsers.map((u) => [u.id, u.name]));

		const skillIds = [];
		for (const r of slice) {
			const ex = exchangeById.get(r.exchange_id);
			if (!ex) continue;
			const skillId = r.to_user_id === ex.owner_id ? ex.skill_requested_id : ex.skill_offered_id;
			if (Number.isInteger(skillId)) skillIds.push(skillId);
		}
		const uniqueSkillIds = Array.from(new Set(skillIds));
		const skills = uniqueSkillIds.length
			? await Skill.find({ id: { $in: uniqueSkillIds } }).select({ id: 1, title: 1 }).lean()
			: [];
		const skillTitleById = new Map(skills.map((s) => [s.id, s.title]));

		return res.json({
			success: true,
			reviews: slice.map((r) => {
				const ex = exchangeById.get(r.exchange_id);
				const skillId = ex ? (r.to_user_id === ex.owner_id ? ex.skill_requested_id : ex.skill_offered_id) : null;
				return {
					id: r.id,
					rating: r.rating,
					comment: decryptText(r.comment),
					created_at: r.created_at,
					from_user_id: r.from_user_id,
					from_name: fromNameById.get(r.from_user_id) || '',
					skill_id: Number.isInteger(skillId) ? skillId : null,
					skill_title: Number.isInteger(skillId) ? skillTitleById.get(skillId) || null : null,
				};
			}),
			pagination: {
				limit,
				offset,
				total,
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

		const users = await User.find({})
			.select({ id: 1, name: 1, created_at: 1 })
			.sort({ created_at: -1 })
			.skip(offset)
			.limit(limit)
			.lean();

		return res.json({ success: true, users, pagination: { limit, offset } });
	} catch (err) {
		return next(err);
	}
}

module.exports = { getMyProfile, getPublicProfile, listPublicReviews, listUsers };
