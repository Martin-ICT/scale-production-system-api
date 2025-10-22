const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    plantList(
      page: Int
      pageSize: Int
      search: String
      filter: PlantFilter
      sort: SortBy
    ): PlantPagination!
    plantDetail(id: ID!): Plant
  }

  extend type Mutation {
    plantCreate(input: PlantInputCreate!): Plant
    plantUpdate(id: ID!, input: PlantInputUpdate!): Plant
    plantDelete(id: ID!): Plant
  }

  input PlantInputCreate {
    name: String!
    code: String!
    address: String!
  }

  input PlantInputUpdate {
    code: String!
    name: String
    address: String
  }

  type Plant {
    id: ID!
    name: String!
    code: String
    address: String

    createdAt: String
    updatedAt: String
  }

  type PlantPagination {
    plants: [Plant]!
    meta: PaginationMeta!
  }

  input PlantFilter {
    userId: ID
    name: String
    description: String
    status: String
    createdDate: DateFilter
  }
`;
