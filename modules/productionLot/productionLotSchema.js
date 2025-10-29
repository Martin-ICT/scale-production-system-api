const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    productionLotList(
      page: Int
      pageSize: Int
      search: String
      filter: ProductionLotFilter
      sort: SortBy
    ): ProductionLotPagination
    productionLotDetail(id: ID!): ProductionLot
  }

  extend type Mutation {
    productionLotCreate(input: ProductionLotInputCreate!): ProductionLot
    productionLotUpdate(
      id: ID!
      input: ProductionLotInputUpdate!
    ): ProductionLot
    productionLotDelete(id: ID!): ProductionLot
  }

  input ProductionLotInputCreate {
    code: String!
  }

  input ProductionLotInputUpdate {
    code: String
  }

  type ProductionLot {
    id: ID!
    code: String!
  }

  type ProductionLotPagination {
    productionLots: [ProductionLot]
    meta: PaginationMeta!
  }

  input ProductionLotFilter {
    code: String
  }
`;
