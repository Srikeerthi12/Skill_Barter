const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { getMyProfile, getPublicProfile, listPublicReviews, listUsers } = require('../controllers/user.controller');

const router = express.Router();

router.get('/me', requireAuth, getMyProfile);
router.get('/', listUsers);
router.get('/:id/reviews', listPublicReviews);
router.get('/:id', getPublicProfile);

module.exports = router;
