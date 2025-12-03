const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    storageLocationTargetList(
      page: Int
      pageSize: Int
      search: String
      filter: StorageLocationTargetFilter
      sort: SortBy
    ): StorageLocationTargetPagination
    storageLocationTargetDetail(id: ID!): StorageLocationTarget
  }

  extend type Mutation {
    storageLocationTargetCreate(
      input: StorageLocationTargetInputCreate!
    ): StorageLocationTarget
    storageLocationTargetUpdate(
      id: ID!
      input: StorageLocationTargetInputUpdate!
    ): StorageLocationTarget
    storageLocationTargetDelete(id: ID!): StorageLocationTarget
  }

  input StorageLocationTargetInputCreate {
    code: String!
    name: String
  }

  input StorageLocationTargetInputUpdate {
    code: String
    name: String
  }

  type StorageLocationTarget {
    id: ID!
    code: String!
    name: String
  }

  type StorageLocationTargetPagination {
    storageLocationTargets: [StorageLocationTarget]
    meta: PaginationMeta!
  }

  input StorageLocationTargetFilter {
    code: String
    name: String
  }
`;

