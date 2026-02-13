const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const skillRoutes = require('./routes/skill.routes');
const exchangeRoutes = require('./routes/exchange.routes');
const userRoutes = require('./routes/user.routes');
const { errorMiddleware } = require('./middleware/error.middleware');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

  app.get('/health', (req, res) => res.json({ ok: true }));
  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/skills', skillRoutes);
  app.use('/api/exchanges', exchangeRoutes);

  app.use(errorMiddleware);

  return app;
}

module.exports = { createApp };
