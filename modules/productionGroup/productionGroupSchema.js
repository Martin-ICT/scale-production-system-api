const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    productionGroupList(
      page: Int
      pageSize: Int
      search: String
      filter: ProductionGroupFilter
      sort: SortBy
    ): ProductionGroupPagination
    productionGroupDetail(id: ID!): ProductionGroup
  }

  extend type Mutation {
    productionGroupCreate(input: ProductionGroupInputCreate!): ProductionGroup
    productionGroupUpdate(
      id: ID!
      input: ProductionGroupInputUpdate!
    ): ProductionGroup
    productionGroupDelete(id: ID!): ProductionGroup
  }

  input ProductionGroupInputCreate {
    name: String!
  }

  input ProductionGroupInputUpdate {
    name: String
  }

  type ProductionGroup {
    id: ID!
    name: String!
  }

  type ProductionGroupPagination {
    productionGroups: [ProductionGroup]
    meta: PaginationMeta!
  }

  input ProductionGroupFilter {
    name: String
  }
`;

