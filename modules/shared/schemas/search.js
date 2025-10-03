const { gql } = require('apollo-server-express');

module.exports = gql`
  input Search {
    query: String
    inColumns: [String]!
  }
`;
