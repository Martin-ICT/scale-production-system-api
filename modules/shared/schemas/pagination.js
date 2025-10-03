const { gql } = require('apollo-server-express');

module.exports = gql`
  type PaginationMeta {
    totalItems: Int!
    totalPages: Int!
    currentPage: Int!
    pageSize: Int!
  }
`;
