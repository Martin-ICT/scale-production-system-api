const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    storageLocationList(
      page: Int
      pageSize: Int
      search: String
      filter: StorageLocationFilter
      sort: SortBy
    ): StorageLocationPagination
    storageLocationDetail(id: ID!): StorageLocation
  }

  extend type Mutation {
    storageLocationCreate(input: StorageLocationInputCreate!): StorageLocation
    storageLocationUpdate(
      id: ID!
      input: StorageLocationInputUpdate!
    ): StorageLocation
    storageLocationDelete(id: ID!): StorageLocation
  }

  input StorageLocationInputCreate {
    code: String!
    name: String
  }

  input StorageLocationInputUpdate {
    code: String
    name: String
  }

  type StorageLocation {
    id: ID!
    code: String!
    name: String
  }

  type StorageLocationPagination {
    storageLocations: [StorageLocation]
    meta: PaginationMeta!
  }

  input StorageLocationFilter {
    code: String
    name: String
  }
`;
