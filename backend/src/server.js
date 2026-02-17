const { connectDb } = require('./config/db');
const { env } = require('./config/env');
const { createApp } = require('./app');
const http = require('http');
const { Server } = require('socket.io');
const { verifyToken } = require('./utils/jwt');
const { encryptText, decryptText } = require('./utils/secureText');
const Exchange = require('./models/exchange.model');
const ExchangeMessage = require('./models/exchangeMessage.model');
const { nextId } = require('./utils/sequence');

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function canChat(status, exchange) {
  if (status === 'completed') return true;
  if (status !== 'accepted') return false;
  if (exchange?.completed_by_requester_at && exchange?.completed_by_owner_at) return true;
  return true;
}

async function start() {
  await connectDb();

  const app = createApp();

  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1] ||
        socket.handshake.query?.token;
      if (!token) return next(new Error('Unauthorized'));
      const decoded = verifyToken(String(token));
      socket.userId = decoded.sub || decoded.userId || decoded.id;
      return next();
    } catch (err) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join_exchange', async ({ exchangeId }) => {
      try {
        const id = Number(exchangeId);
        if (!Number.isInteger(id) || id <= 0) return;

        const ex = await Exchange.findOne({ id })
          .select({ id: 1, requester_id: 1, owner_id: 1, status: 1, completed_by_requester_at: 1, completed_by_owner_at: 1 })
          .lean();
        if (!ex) return;
        const me = String(socket.userId);
        if (String(ex.requester_id) !== me && String(ex.owner_id) !== me) return;
        if (!canChat(ex.status, ex) || !['accepted', 'completed'].includes(ex.status)) return;

        await socket.join(`exchange:${id}`);
        socket.emit('joined_exchange', { exchangeId: id });
      } catch (e) {
        // ignore
      }
    });

    socket.on('typing', async ({ exchangeId, isTyping }) => {
      const id = Number(exchangeId);
      if (!Number.isInteger(id) || id <= 0) return;
      socket.to(`exchange:${id}`).emit('typing', {
        exchangeId: id,
        fromUserId: socket.userId,
        isTyping: Boolean(isTyping),
      });
    });

    socket.on('send_message', async ({ exchangeId, body }) => {
      try {
        const id = Number(exchangeId);
        const text = String(body || '').trim();
        if (!Number.isInteger(id) || id <= 0) return;
        if (!text) return;
        if (text.length > 2000) return;

        const ex = await Exchange.findOne({ id })
          .select({ id: 1, requester_id: 1, owner_id: 1, status: 1, completed_by_requester_at: 1, completed_by_owner_at: 1 })
          .lean();
        if (!ex) return;
        const me = String(socket.userId);
        if (String(ex.requester_id) !== me && String(ex.owner_id) !== me) return;
        if (ex.status !== 'accepted') return;
        if (ex.completed_by_requester_at && ex.completed_by_owner_at) return;

        const toUserId = String(ex.owner_id) === me ? ex.requester_id : ex.owner_id;

        const fromUserId = toInt(socket.userId);
        const toUserIdNum = toInt(toUserId);
        if (!fromUserId || !toUserIdNum) return;

        const msgDoc = await ExchangeMessage.create({
          id: await nextId('exchange_messages'),
          exchange_id: id,
          from_user_id: fromUserId,
          to_user_id: toUserIdNum,
          body: encryptText(text),
          delivered_at: new Date(),
        });

        const msg = {
          id: msgDoc.id,
          exchange_id: msgDoc.exchange_id,
          from_user_id: msgDoc.from_user_id,
          to_user_id: msgDoc.to_user_id,
          body: msgDoc.body,
          delivered_at: msgDoc.delivered_at,
          read_at: msgDoc.read_at,
          created_at: msgDoc.created_at,
        };
        io.to(`exchange:${id}`).emit('new_message', {
          exchangeId: id,
          message: { ...msg, body: decryptText(msg.body) },
        });
      } catch (e) {
        // ignore
      }
    });

    socket.on('mark_read', async ({ exchangeId }) => {
      try {
        const id = Number(exchangeId);
        if (!Number.isInteger(id) || id <= 0) return;

        const ex = await Exchange.findOne({ id })
          .select({ id: 1, requester_id: 1, owner_id: 1, status: 1, completed_by_requester_at: 1, completed_by_owner_at: 1 })
          .lean();
        if (!ex) return;
        const me = String(socket.userId);
        if (String(ex.requester_id) !== me && String(ex.owner_id) !== me) return;

        if (!['accepted', 'completed'].includes(ex.status) && !(ex.status === 'accepted' && ex.completed_by_requester_at && ex.completed_by_owner_at)) {
          return;
        }

        const toUserId = toInt(socket.userId);
        if (!toUserId) return;
        await ExchangeMessage.updateMany(
          { exchange_id: id, to_user_id: toUserId, read_at: null },
          { $set: { read_at: new Date() } }
        );
        io.to(`exchange:${id}`).emit('read', { exchangeId: id, userId: socket.userId });
      } catch (e) {
        // ignore
      }
    });
  });

  server.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server', err);
  process.exit(1);
});
