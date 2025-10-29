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
    code: String!
    name: String!
  }

  input PackingGroupInputUpdate {
    code: String
    name: String
  }

  type PackingGroupCount {
    count: Int!
  }

  type PackingGroup {
    id: ID!
    code: String!
    name: String!
  }

  type PackingGroupPagination {
    packingGroups: [PackingGroup]
    meta: PaginationMeta!
  }

  input PackingGroupFilter {
    code: String
    name: String
  }
`;
