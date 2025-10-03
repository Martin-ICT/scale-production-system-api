const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    scaleList(
      page: Int
      pageSize: Int
      search: String
      filter: ScaleFilter
      sort: SortBy
    ): ScalePagination
    scaleDetail(id: ID!): Scale
  }

  extend type Mutation {
    scaleCreate(input: ScaleInputCreate!): Scale
    scaleUpdate(id: ID!, input: ScaleInputUpdate!): Scale
    scaleDelete(id: ID!): Scale
  }

  input ScaleInputCreate {
    name: String!
    code: String!
  }

  input ScaleInputUpdate {
    name: String
    code: String
  }

  type Scale {
    id: ID!
    name: String!
    deviceId: String
    status: String
    plants: [Plant]
    createdAt: String
    updatedAt: String
  }

  type ScalePagination {
    companies: [Scale]
    meta: PaginationMeta!
  }

  input ScaleFilter {
    name: String
    code: String
    status: String
    createdDate: DateFilter
  }
`;

