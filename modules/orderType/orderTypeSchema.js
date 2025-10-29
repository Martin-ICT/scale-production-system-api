const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    orderTypeList(
      page: Int
      pageSize: Int
      search: String
      filter: OrderTypeFilter
      sort: SortBy
    ): OrderTypePagination
    orderTypeDetail(id: ID!): OrderType
  }

  extend type Mutation {
    orderTypeCreate(input: OrderTypeInputCreate!): OrderType
    orderTypeUpdate(id: ID!, input: OrderTypeInputUpdate!): OrderType
    orderTypeDelete(id: ID!): OrderType
  }

  input OrderTypeInputCreate {
    code: String!
    name: String!
    processType: Int!
    maxDay: Int!
  }

  input OrderTypeInputUpdate {
    code: String
    name: String
    processType: Int
    maxDay: Int
  }

  type OrderType {
    id: ID!
    code: String!
    name: String!
    processType: Int!
    maxDay: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type OrderTypePagination {
    orderTypes: [OrderType]
    meta: PaginationMeta!
  }

  input OrderTypeFilter {
    code: String
    name: String
    processType: Int
    maxDay: Int
  }
`;
