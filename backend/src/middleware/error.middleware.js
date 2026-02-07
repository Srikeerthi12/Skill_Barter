function errorMiddleware(err, req, res, next) {
  const status = err?.statusCode || err?.status || 500;
  const message = err?.message || 'Internal Server Error';

  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(status).json({
    success: false,
    message,
  });
}

module.exports = { errorMiddleware };
