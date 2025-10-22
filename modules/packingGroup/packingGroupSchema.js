const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    packingGroupList(
      page: Int
      pageSize: Int
      search: String
      filter: PackingGroupFilter
      sort: SortBy
    ): PackingGroupPagination
    packingGroupDetail(id: ID!): PackingGroup
  }

  extend type Mutation {
    packingGroupCreate(input: PackingGroupInputCreate!): PackingGroup
    packingGroupUpdate(id: ID!, input: PackingGroupInputUpdate!): PackingGroup
    packingGroupDelete(id: ID!): PackingGroup
  }

  input PackingGroupInputCreate {
    name: String!
  }

  input PackingGroupInputUpdate {
    name: String
  }

  type PackingGroupCount {
    count: Int!
  }

  type PackingGroup {
    id: ID!
    name: String!
  }

  type PackingGroupPagination {
    packingGroups: [PackingGroup]
    meta: PaginationMeta!
  }

  input PackingGroupFilter {
    name: String
  }
`;
