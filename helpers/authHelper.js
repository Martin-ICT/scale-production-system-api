const { AuthenticationError } = require('apollo-server');
const { authenticateLDAP } = require('../middlewares/ldap');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

const generateToken = (user) => {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
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

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new AuthenticationError('Invalid credentials');
  }

  return generateToken(user);
};
