const { connectDb } = require('./config/db');
const { env } = require('./config/env');
const { createApp } = require('./app');
const http = require('http');
const { Server } = require('socket.io');
const { verifyToken } = require('./utils/jwt');
const { query } = require('./config/db');
const { encryptText, decryptText } = require('./utils/secureText');

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
      socket.userId = decoded.id;
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

        const exResult = await query(
          'SELECT id, requester_id, owner_id, status FROM exchanges WHERE id = $1',
          [id]
        );
        const ex = exResult.rows[0];
        if (!ex) return;
        const me = String(socket.userId);
        if (String(ex.requester_id) !== me && String(ex.owner_id) !== me) return;
        if (!['accepted', 'completed'].includes(ex.status)) return;

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

        const exResult = await query(
          'SELECT id, requester_id, owner_id, status FROM exchanges WHERE id = $1',
          [id]
        );
        const ex = exResult.rows[0];
        if (!ex) return;
        const me = String(socket.userId);
        if (String(ex.requester_id) !== me && String(ex.owner_id) !== me) return;
        if (ex.status !== 'accepted') return;

        const toUserId = String(ex.owner_id) === me ? ex.requester_id : ex.owner_id;
        const inserted = await query(
          `INSERT INTO exchange_messages(exchange_id, from_user_id, to_user_id, body, delivered_at)
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING id, exchange_id, from_user_id, to_user_id, body, delivered_at, read_at, created_at`,
          [id, socket.userId, toUserId, encryptText(text)]
        );
        const msg = inserted.rows[0];
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

        const exResult = await query(
          'SELECT id, requester_id, owner_id, status FROM exchanges WHERE id = $1',
          [id]
        );
        const ex = exResult.rows[0];
        if (!ex) return;
        const me = String(socket.userId);
        if (String(ex.requester_id) !== me && String(ex.owner_id) !== me) return;
        if (!['accepted', 'completed'].includes(ex.status)) return;

        await query(
          `UPDATE exchange_messages
           SET read_at = COALESCE(read_at, NOW())
           WHERE exchange_id = $1
             AND to_user_id = $2
             AND read_at IS NULL`,
          [id, socket.userId]
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
