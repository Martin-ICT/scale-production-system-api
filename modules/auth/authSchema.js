const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    authMe: User
    authVerifyToken(token: String!): TokenVerification
  }

  extend type Mutation {
    login(input: LoginInput!): AuthResponse
  }

  input LoginInput {
    email: String!
    password: String!
  }

  type AuthResponse {
    success: Boolean!
    message: String!
    token: String
    user: User
  }

  type TokenVerification {
    valid: Boolean!
    user: User
    message: String
  }

  type User {
    userId: ID!
    clientId: Int!
    name: String!
    email: String
    isActive: String!
  }
`;
