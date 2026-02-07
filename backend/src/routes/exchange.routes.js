const express = require('express');
const {
  createExchangeRequest,
  listLearning,
  listExchangeRequests,
  respondToExchangeRequest,
} = require('../controllers/exchange.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/learning', requireAuth, listLearning);
router.get('/', requireAuth, listExchangeRequests);
router.post('/', requireAuth, createExchangeRequest);
router.patch('/:id/respond', requireAuth, respondToExchangeRequest);

module.exports = router;
