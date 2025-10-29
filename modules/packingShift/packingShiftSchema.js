const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    packingShiftList(
      page: Int
      pageSize: Int
      search: String
      filter: PackingShiftFilter
      sort: SortBy
    ): PackingShiftPagination
    packingShiftDetail(id: ID!): PackingShift
  }

  extend type Mutation {
    packingShiftCreate(input: PackingShiftInputCreate!): PackingShift
    packingShiftUpdate(id: ID!, input: PackingShiftInputUpdate!): PackingShift
    packingShiftDelete(id: ID!): PackingShift
  }

  input PackingShiftInputCreate {
    code: String!
    name: String!
  }

  input PackingShiftInputUpdate {
    code: String
    name: String
  }

  type PackingShift {
    id: ID!
    code: String!
    name: String!
  }

  type PackingShiftPagination {
    packingShifts: [PackingShift]
    meta: PaginationMeta!
  }

  input PackingShiftFilter {
    code: String
    name: String
  }
`;
