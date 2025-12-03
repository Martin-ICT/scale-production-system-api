const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    materialOrderTypeList(
      page: Int
      pageSize: Int
      search: String
      filter: MaterialOrderTypeFilter
      sort: SortBy
    ): MaterialOrderTypePagination
    materialOrderTypeDetail(
      materialId: ID!
      orderTypeId: ID!
    ): MaterialOrderType
    materialOrderTypeCount(
      filter: MaterialOrderTypeFilter
    ): MaterialOrderTypeCount
  }

  # No Mutation section - MaterialOrderType is read-only from external database

  type MaterialOrderType {
    clientId: Int!
    materialId: Int!
    orderTypeId: Int
    minWeight: Int
    maxWeight: Int
    material: Material
    orderType: ElementValue
  }

  type MaterialOrderTypePagination {
    materialOrderTypes: [MaterialOrderType]
    meta: PaginationMeta!
  }

  type MaterialOrderTypeCount {
    count: Int!
  }

  input MaterialOrderTypeFilter {
    materialId: Int
    orderTypeId: Int
  }
`;
