const { AuthenticationError } = require('apollo-server');
const { authenticateLDAP } = require('../middlewares/ldap');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET =
  process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const generateToken = (user) => {
  return jwt.sign({ userId: user.userId }, JWT_SECRET, { expiresIn: '7d' });
};

module.exports = async (user, password) => {
  try {
    const ldapResult = await authenticateLDAP(user.email, password);

    if (ldapResult) {
      console.log('[LDAP] Auth success:', ldapResult.dn);
      return generateToken(user);
    }
  } catch (err) {
    console.warn('[LDAP] Auth failed:', err);
  }

  const isPasswordValid = password === user.password;
  if (!isPasswordValid) {
    throw new AuthenticationError('Invalid credentials');
  }

  return generateToken(user);
};
