const Skill = require('../models/skill.model');
const User = require('../models/user.model');
const Exchange = require('../models/exchange.model');
const ExchangeFeedback = require('../models/exchangeFeedback.model');
const { decryptText } = require('../utils/secureText');
const { nextId } = require('../utils/sequence');

function round2(value) {
	return Math.round(Number(value) * 100) / 100;
}

async function computeSkillRatingStats(skillIds) {
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

async function listSkills(req, res, next) {
	try {
		const skills = await Skill.find({}).sort({ created_at: -1 }).lean();
		const skillIds = skills.map((s) => s.id);
		const ownerIds = Array.from(new Set(skills.map((s) => s.user_id)));

		const owners = await User.find({ id: { $in: ownerIds } }).select({ id: 1, name: 1 }).lean();
		const ownerNameById = new Map(owners.map((u) => [u.id, u.name]));
		const repBySkill = await computeSkillRatingStats(skillIds);

		return res.json({
			success: true,
			skills: skills.map((s) => {
				const rep = repBySkill.get(s.id) || { average_rating: 0, ratings_count: 0 };
				return {
					id: s.id,
					user_id: s.user_id,
					owner_name: ownerNameById.get(s.user_id) || '',
					title: s.title,
					description: s.description,
					created_at: s.created_at,
					skill_average_rating: rep.average_rating,
					skill_ratings_count: rep.ratings_count,
				};
			}),
		});
	} catch (err) {
		return next(err);
	}
}

async function getSkill(req, res, next) {
	try {
		const skillId = Number(req.params.id);
		if (!Number.isInteger(skillId) || skillId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid skill id' });
		}

		const skill = await Skill.findOne({ id: skillId }).lean();
		if (!skill) return res.status(404).json({ success: false, message: 'Skill not found' });

		const owner = await User.findOne({ id: skill.user_id }).select({ id: 1, name: 1 }).lean();
		const repBySkill = await computeSkillRatingStats([skillId]);
		const rep = repBySkill.get(skillId) || { average_rating: 0, ratings_count: 0 };

		return res.json({
			success: true,
			skill: {
				id: skill.id,
				user_id: skill.user_id,
				owner_name: owner?.name || '',
				title: skill.title,
				description: skill.description,
				created_at: skill.created_at,
				skill_average_rating: rep.average_rating,
				skill_ratings_count: rep.ratings_count,
			},
		});
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

		const skill = await Skill.findOne({ id: skillId }).select({ id: 1 }).lean();
		if (!skill) return res.status(404).json({ success: false, message: 'Skill not found' });

		const limitRaw = req.query.limit;
		const offsetRaw = req.query.offset;
		const limit = Math.min(Math.max(Number(limitRaw || 20), 1), 50);
		const offset = Math.max(Number(offsetRaw || 0), 0);

		const exchanges = await Exchange.find({
			status: 'completed',
			$or: [{ skill_requested_id: skillId }, { skill_offered_id: skillId }],
		})
			.select({ id: 1, owner_id: 1, requester_id: 1, skill_requested_id: 1, skill_offered_id: 1 })
			.lean();

		const exchangeById = new Map(exchanges.map((e) => [e.id, e]));
		const exchangeIds = Array.from(exchangeById.keys());
		if (!exchangeIds.length) {
			return res.json({ success: true, reviews: [], pagination: { limit, offset, total: 0 } });
		}

		const feedback = await ExchangeFeedback.find({ exchange_id: { $in: exchangeIds } })
			.select({ id: 1, exchange_id: 1, rating: 1, comment: 1, created_at: 1, from_user_id: 1, to_user_id: 1 })
			.lean();

		const reviewsAll = [];
		for (const fb of feedback) {
			const ex = exchangeById.get(fb.exchange_id);
			if (!ex) continue;
			const isRequestedSkillReview =
				ex.skill_requested_id === skillId &&
				fb.to_user_id === ex.owner_id &&
				fb.from_user_id === ex.requester_id;
			const isOfferedSkillReview =
				ex.skill_offered_id === skillId &&
				fb.to_user_id === ex.requester_id &&
				fb.from_user_id === ex.owner_id;
			if (!isRequestedSkillReview && !isOfferedSkillReview) continue;
			reviewsAll.push(fb);
		}

		reviewsAll.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
		const total = reviewsAll.length;
		const slice = reviewsAll.slice(offset, offset + limit);

		const fromIds = Array.from(new Set(slice.map((r) => r.from_user_id)));
		const fromUsers = await User.find({ id: { $in: fromIds } }).select({ id: 1, name: 1 }).lean();
		const fromNameById = new Map(fromUsers.map((u) => [u.id, u.name]));

		return res.json({
			success: true,
			reviews: slice.map((r) => ({
				id: r.id,
				rating: r.rating,
				comment: decryptText(r.comment),
				created_at: r.created_at,
				from_user_id: r.from_user_id,
				from_name: fromNameById.get(r.from_user_id) || '',
			})),
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

async function createSkill(req, res, next) {
	try {
		const { title, description } = req.body || {};
		if (!title) return res.status(400).json({ success: false, message: 'title is required' });

		const userId = Number(req.userId);
		if (!Number.isInteger(userId) || userId <= 0) {
			return res.status(401).json({ success: false, message: 'Unauthorized' });
		}

		const skill = await Skill.create({
			id: await nextId('skills'),
			user_id: userId,
			title: String(title),
			description: description ? String(description) : '',
		});

		return res.status(201).json({
			success: true,
			skill: {
				id: skill.id,
				user_id: skill.user_id,
				title: skill.title,
				description: skill.description,
				created_at: skill.created_at,
			},
		});
	} catch (err) {
		return next(err);
	}
}

async function updateSkill(req, res, next) {
	try {
		const skillId = Number(req.params.id);
		if (!Number.isInteger(skillId) || skillId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid skill id' });
		}

		const { title, description } = req.body || {};
		const existing = await Skill.findOne({ id: skillId }).lean();
		if (!existing) return res.status(404).json({ success: false, message: 'Skill not found' });
		if (String(existing.user_id) !== String(req.userId)) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}

		const update = {};
		if (title !== undefined) update.title = String(title);
		if (description !== undefined) update.description = String(description);

		const updated = await Skill.findOneAndUpdate({ id: skillId }, { $set: update }, { new: true }).lean();
		return res.json({
			success: true,
			skill: {
				id: updated.id,
				user_id: updated.user_id,
				title: updated.title,
				description: updated.description,
				created_at: updated.created_at,
			},
		});
	} catch (err) {
		return next(err);
	}
}

async function deleteSkill(req, res, next) {
	try {
		const skillId = Number(req.params.id);
		if (!Number.isInteger(skillId) || skillId <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid skill id' });
		}

		const existing = await Skill.findOne({ id: skillId }).lean();
		if (!existing) return res.status(404).json({ success: false, message: 'Skill not found' });
		if (String(existing.user_id) !== String(req.userId)) {
			return res.status(403).json({ success: false, message: 'Forbidden' });
		}

		const blockingCount = await Exchange.countDocuments({
			$and: [
				{ status: { $nin: ['pending', 'rejected', 'cancelled'] } },
				{ $or: [{ skill_offered_id: skillId }, { skill_requested_id: skillId }] },
			],
		});
		if (blockingCount > 0) {
			return res.status(409).json({
				success: false,
				message: 'Cannot delete skill: it is tied to an accepted/completed exchange.',
			});
		}

		await Skill.deleteOne({ id: skillId });
		return res.json({ success: true });
	} catch (err) {
		return next(err);
	}
}

module.exports = { createSkill, listSkills, getSkill, listSkillReviews, updateSkill, deleteSkill };

