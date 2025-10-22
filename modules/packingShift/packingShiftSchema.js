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
    name: String!
  }

  input PackingShiftInputUpdate {
    name: String
  }

  type PackingShift {
    id: ID!
    name: String!
  }

  type PackingShiftPagination {
    packingShifts: [PackingShift]
    meta: PaginationMeta!
  }

  input PackingShiftFilter {
    name: String
  }
`;

