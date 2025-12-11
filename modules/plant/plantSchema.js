const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    plantList(
      page: Int
      pageSize: Int
      search: String
      filter: PlantFilter
      sort: SortBy
    ): PlantPagination
    plantDetail(id: ID!): Plant
  }

  type Plant {
    id: ID!
    code: String!
    name: String!
    description: String
  }

  type PlantPagination {
    plants: [Plant]
    meta: PaginationMeta!
  }

  input PlantFilter {
    code: String
    name: String
    description: String
  }
`;
