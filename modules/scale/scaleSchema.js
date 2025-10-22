const { gql } = require('apollo-server');

module.exports = gql`
  enum ScaleCapacity {
    _3KG
    _6KG
    _9KG
    _12KG
    _15KG
  }

  enum ScaleUOM {
    KG
    G
  }

  extend type Query {
    scaleCount(filter: ScaleFilter): ScaleCount
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
    deviceIP: String!
    deviceId: String!
    brand: String!
    plantCode: String
    uom: ScaleUOM!
    capacity: ScaleCapacity!
    lastCalibrate: DateTime
  }

  input ScaleInputUpdate {
    name: String
    deviceIP: String
    deviceId: String
    brand: String
    plantCode: String
    uom: ScaleUOM
    capacity: ScaleCapacity
    lastCalibrate: DateTime
  }

  type ScaleCount {
    count: Int!
  }

  type Scale {
    id: ID!
    name: String!
    deviceIP: String!
    deviceId: String!
    brand: String!
    plantCode: String
    capacity: ScaleCapacity!
    uom: ScaleUOM!
    lastCalibrate: DateTime
    createdAt: DateTime
    updatedAt: DateTime
    deletedAt: DateTime
  }

  type ScalePagination {
    scales: [Scale]
    meta: PaginationMeta!
  }

  input ScaleFilter {
    plantCode: String
    capacity: ScaleCapacity
    uom: ScaleUOM
    createdDate: DateFilter
  }
`;
