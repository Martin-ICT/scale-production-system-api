const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    productionShiftList(
      page: Int
      pageSize: Int
      search: String
      filter: ProductionShiftFilter
      sort: SortBy
    ): ProductionShiftPagination
    productionShiftDetail(id: ID!): ProductionShift
  }

  extend type Mutation {
    productionShiftCreate(input: ProductionShiftInputCreate!): ProductionShift
    productionShiftUpdate(
      id: ID!
      input: ProductionShiftInputUpdate!
    ): ProductionShift
    productionShiftDelete(id: ID!): ProductionShift
  }

  input ProductionShiftInputCreate {
    code: String!
    name: String!
  }

  input ProductionShiftInputUpdate {
    code: String
    name: String
  }

  type ProductionShift {
    id: ID!
    code: String!
    name: String!
  }

  type ProductionShiftPagination {
    productionShifts: [ProductionShift]
    meta: PaginationMeta!
  }

  input ProductionShiftFilter {
    code: String
    name: String
  }
`;
