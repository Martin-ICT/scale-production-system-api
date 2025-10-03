const { gql } = require('apollo-server-express');

module.exports = gql`
  input SortBy {
    columnName: String!
    sortOrder: SortOrder!
  }

  enum SortOrder {
    ASC
    DESC
  }
`;
