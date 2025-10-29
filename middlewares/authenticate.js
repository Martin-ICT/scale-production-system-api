const { AuthenticationError } = require('apollo-server');
const { verifyToken } = require('../helpers/jwtHelper');
const User = require('../models/user');

/**
 * Middleware to authenticate user from JWT token
 * Extracts token from Authorization header: "Bearer <token>"
 */
const authenticate = async ({ req }) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization || '';

    if (!authHeader) {
      return { user: null, authError: null };
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return { user: null, authError: null };
    }

    // Verify and decode token
    const decoded = verifyToken(token);

    // Get user from database using userId from token
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password'] },
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    if (user.isActive !== 'Y') {
      throw new AuthenticationError('User account is inactive');
    }

    return { user, authError: null };
  } catch (error) {
    // If token is invalid or expired, return error details
    console.error('Authentication error:', error.message);

    // Check if it's a JWT error
    if (
      error.message.includes('expired') ||
      error.message.includes('Invalid token')
    ) {
      return { user: null, authError: error.message };
    }

    return { user: null, authError: null };
  }
};

module.exports = authenticate;
