const { ForbiddenError } = require('apollo-server');
const { skip } = require('graphql-resolvers');

module.exports = (parent, args, { user }) =>
  user ? skip : new ForbiddenError('User not authenticated. Error: NOT_AUTHENTICATED');
