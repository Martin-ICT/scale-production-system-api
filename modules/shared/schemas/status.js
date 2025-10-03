const { gql } = require('apollo-server-express');

module.exports = gql`
  enum Status {
    Active
    Inactive
  }
`;
