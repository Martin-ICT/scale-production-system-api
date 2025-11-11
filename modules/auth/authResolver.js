const { ApolloError, AuthenticationError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const User = require('../../models/user');
const Organization = require('../../models/organization');
const { generateToken, verifyToken } = require('../../helpers/jwtHelper');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const isAuthenticated = require('../../middlewares/isAuthenticated');
const authHelper = require('../../helpers/authHelper');

const validationSchemas = {
  login: Joi.object({
    email: Joi.string().required(),
    password: Joi.string().required(),
  }),
};

const validateInput = (schema, data) => {
  const { error } = schema.validate(data, {
    convert: true,
    abortEarly: false,
    allowUnknown: true,
  });
  if (error) joiErrorCallback(error);
};

// Helper function to fetch and attach organization data to user
const attachOrganizationToUser = async (user) => {
  if (!user || !user.organizationId) {
    return {
      plantCode: null,
      plantName: null,
    };
  }

  try {
    const organization = await Organization.findByPk(user.organizationId);
    if (organization) {
      return {
        plantCode: organization.code,
        plantName: organization.name,
      };
    }
  } catch (err) {
    // If organization not found, return null values
    console.error('Error fetching organization:', err);
  }

  return {
    plantCode: null,
    plantName: null,
  };
};

module.exports = {
  Query: {
    authMe: combineResolvers(isAuthenticated, async (_, __, { user }) => {
      try {
        return user;
      } catch (err) {
        throw err;
      }
    }),

    authVerifyToken: async (_, { token }) => {
      try {
        const decoded = verifyToken(token);

        const user = await User.findByPk(decoded.userId, {
          attributes: { exclude: ['password'] },
        });

        if (!user) {
          return {
            valid: false,
            user: null,
            message: 'User not found',
          };
        }

        if (user.isActive !== 'Y') {
          return {
            valid: false,
            user: null,
            message: 'User account is inactive',
          };
        }

        // Fetch organization data and attach to user
        const organizationData = await attachOrganizationToUser(user);
        const userResponse = user.toJSON();
        userResponse.plantCode = organizationData.plantCode;
        userResponse.plantName = organizationData.plantName;

        return {
          valid: true,
          user: userResponse,
          message: 'Token is valid',
        };
      } catch (err) {
        return {
          valid: false,
          user: null,
          message: err.message || 'Invalid token',
        };
      }
    },
  },

  Mutation: {
    login: async (_, { input }) => {
      validateInput(validationSchemas.login, input);

      try {
        const { email, password } = input;

        const processedEmail = input.email.trim().toLowerCase();

        // Find user by email

        const user = await User.findOne({ where: { email: processedEmail } });

        if (!user) {
          throw new AuthenticationError('Invalid name or password');
        }

        // Check if user is active
        if (user.isActive !== 'Y') {
          throw new AuthenticationError('User account is inactive');
        }

        // // Compare password
        // const isPasswordValid = await user.comparePassword(password);

        // if (!isPasswordValid) {
        //   throw new AuthenticationError('Invalid name or password');
        // }

        if (!user) {
          throw new ApolloError('User not found', apolloErrorCodes.NOT_FOUND);
        }

        const token = await authHelper(user, input.password);
        // Generate JWT token
        // const token = generateToken({
        //   userId: user.userId,
        //   clientId: user.clientId,
        //   name: user.name,
        //   email: user.email,
        // });

        // Fetch organization data and attach to user
        const organizationData = await attachOrganizationToUser(user);

        // Return user without password
        const userResponse = user.toJSON();
        delete userResponse.password;

        // Add plantCode and plantName to user response
        userResponse.plantCode = organizationData.plantCode;
        userResponse.plantName = organizationData.plantName;

        return {
          success: true,
          message: 'Login successful',
          token,
          user: userResponse,
        };
      } catch (err) {
        if (err instanceof AuthenticationError) {
          throw err;
        }
        throw new ApolloError(
          err.message || 'Login failed',
          apolloErrorCodes.INTERNAL_ERROR
        );
      }
    },
  },
};
