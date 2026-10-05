const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  const secret = process.env.JWT_SECRET || 'fallback_secret_key_for_development';
  const expiresIn = process.env.JWT_EXPIRES_IN || '30d';

  return jwt.sign({ id }, secret, {
    expiresIn
  });
};

module.exports = generateToken;
