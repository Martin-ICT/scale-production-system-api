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
    name: String!
  }

  input StorageLocationInputUpdate {
    name: String
  }

  type StorageLocation {
    id: ID!
    name: String!
  }

  type StorageLocationPagination {
    storageLocations: [StorageLocation]
    meta: PaginationMeta!
  }

  input StorageLocationFilter {
    name: String
  }
`;

