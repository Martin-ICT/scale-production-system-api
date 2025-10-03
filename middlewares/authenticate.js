const jwt = require('jsonwebtoken');
const { ApolloError } = require('apollo-server');

const JWT_SECRET = process.env.JWT_SECRET;

const authenticate = async ({ req }) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return { user: null };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    return { user: decoded };
  } catch (err) {
    console.log('TEST', err);
    if (err.name === 'TokenExpiredError') {
      throw new ApolloError('Session expired. Please sign in again.', 'SESSION_EXPIRED');
    }

    throw new ApolloError('Invalid or expired token. Please sign in again.', 'INVALID_TOKEN');
  }
};

module.exports = authenticate;
