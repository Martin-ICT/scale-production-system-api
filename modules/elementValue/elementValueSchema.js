const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    elementValueList(
      page: Int
      pageSize: Int
      search: String
      filter: ElementValueFilter
      sort: SortBy
    ): ElementValuePagination
    elementValueDetail(id: ID!): ElementValue
    elementValueCount(filter: ElementValueFilter): ElementValueCount
    elementValueByOrderType(
      materialId: ID!
      page: Int
      pageSize: Int
    ): ElementValuePagination
  }

  # No Mutation section - ElementValue is read-only from external database

  type ElementValue {
    id: ID
    clientId: Int
    code: String
    name: String
    description: String
  }

  type ElementValuePagination {
    elementValues: [ElementValue]
    meta: PaginationMeta!
  }

  type ElementValueCount {
    count: Int!
  }

  input ElementValueFilter {
    code: String
    name: String
  }
`;
