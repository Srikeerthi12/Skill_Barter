const { connectDb } = require('./config/db');
const { env } = require('./config/env');
const { createApp } = require('./app');

async function start() {
  await connectDb();

  const app = createApp();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server', err);
  process.exit(1);
});
