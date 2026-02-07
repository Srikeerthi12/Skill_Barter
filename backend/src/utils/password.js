const bcrypt = require('bcryptjs');

async function hashPassword(plainText) {
  const saltRounds = 10;
  return bcrypt.hash(plainText, saltRounds);
}

async function verifyPassword(plainText, passwordHash) {
  return bcrypt.compare(plainText, passwordHash);
}

module.exports = { hashPassword, verifyPassword };
