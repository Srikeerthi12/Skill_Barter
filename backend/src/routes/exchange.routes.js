const express = require('express');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const {
  createExchangeRequest,
  listLearning,
  listTeaching,
  listExchangeRequests,
  respondToExchangeRequest,
  completeExchange,
  listChatConversations,
  listExchangeMessages,
  sendExchangeMessage,
  sendExchangeAttachmentMessage,
  markExchangeRead,
  toggleMessageReaction,
  upsertExchangeFeedback,
  getExchangeFeedback,
} = require('../controllers/exchange.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', '..', 'uploads'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '');
      cb(null, `chat_${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.get('/learning', requireAuth, listLearning);
router.get('/teaching', requireAuth, listTeaching);
router.get('/chats', requireAuth, listChatConversations);
router.get('/', requireAuth, listExchangeRequests);
router.post('/', requireAuth, createExchangeRequest);
router.patch('/:id/respond', requireAuth, respondToExchangeRequest);
router.patch('/:id/complete', requireAuth, completeExchange);
router.post('/:id/complete', requireAuth, completeExchange);
router.get('/:id/messages', requireAuth, listExchangeMessages);
router.post('/:id/messages', requireAuth, sendExchangeMessage);
router.post('/:id/messages/upload', requireAuth, upload.single('file'), sendExchangeAttachmentMessage);
router.post('/:id/messages/read', requireAuth, markExchangeRead);
router.post('/:id/messages/:messageId/reactions', requireAuth, toggleMessageReaction);
router.get('/:id/feedback', requireAuth, getExchangeFeedback);
router.post('/:id/feedback', requireAuth, upsertExchangeFeedback);

module.exports = router;
