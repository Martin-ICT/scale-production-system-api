const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    materialList(
      page: Int
      pageSize: Int
      search: String
      filter: MaterialFilter
      sort: SortBy
    ): MaterialPagination
    materialDetail(id: ID!): Material
    materialCount(filter: MaterialFilter): MaterialCount
  }

  # No Mutation section - Material is read-only from external database

  enum MaterialMeasurementType {
    ACTUAL
    STANDARD
  }

  type Material {
    id: ID!
    clientId: Int
    code: String!
    name: String!
    measurementType: MaterialMeasurementType
    measurementTypeValue: Decimal
    minWeight: Float
    maxWeight: Float
    uomId: Int!
    uom: MaterialUom
    orderTypes: [ElementValue] # Changed to array
  }

  type MaterialUom {
    id: ID!
    code: String!
    name: String!
  }

  type MaterialPagination {
    materials: [Material]
    meta: PaginationMeta!
  }

  type MaterialCount {
    count: Int!
  }

  input MaterialFilter {
    code: String
    name: String
    uomId: Int
    id: ID
    orderTypeCode: String # Filter by orderType code
  }
`;
