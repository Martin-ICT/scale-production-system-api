const { ForbiddenError } = require('apollo-server');
const { combineResolvers, skip } = require('graphql-resolvers');
const isAuthenticated = require('./isAuthenticated');

module.exports = (permissionName) =>
  combineResolvers(isAuthenticated, (parent, args, { user: { userPermissions } }) =>
    userPermissions.find((x) => x.name === permissionName) ? skip : new ForbiddenError('Permission is not authorized')
  );
