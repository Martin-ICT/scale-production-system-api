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
    companyId: ID!
  }

  input PlantInputUpdate {
    code: String!
    name: String
    address: String
    companyId: ID!
  }

  type Plant {
    id: ID!
    name: String!
    code: String
    address: String

    # company
    companyId: ID
    company: Company

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
    companyId: ID
    status: String
    createdDate: DateFilter
  }
`;
