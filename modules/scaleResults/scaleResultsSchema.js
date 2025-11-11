const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    scaleResultsList(
      page: Int
      pageSize: Int
      search: String
      filter: ScaleResultsFilter
      sort: SortBy
    ): ScaleResultsPagination!
    scaleResultsDetail(id: ID!): ScaleResults
    scaleResultsListByScale(
      scaleId: String!
      page: Int
      pageSize: Int
      sort: SortBy
    ): ScaleResultsPagination!
  }

  extend type Mutation {
    scaleResultsCreate(input: ScaleResultsInputCreate!): ScaleResults
    scaleResultsBatchCreate(
      input: ScaleResultsInputBatchCreate!
    ): [ScaleResults!]!
    scaleResultsUpdate(id: ID!, input: ScaleResultsInputUpdate!): ScaleResults
    scaleResultsDelete(id: ID!): Boolean
  }

  input ScaleResultsInputCreate {
    scaleId: String!
    productionOrderNumber: String
    plantCode: String
    materialCode: String
    materialUom: String
    weight: Float
    uom: String
    weightConverted: Float
    productionGroup: String
    productionShift: Int
    packingGroup: String
    packingShift: Int
    productionLot: String
    productionLocation: String
    storageLocation: String
    scaleTransactionId: String
    transactionType: String
    isSummarized: Boolean
  }

  input ScaleResultsInputBatchCreate {
    scaleResults: [ScaleResultsInputCreate!]!
  }

  input ScaleResultsInputUpdate {
    productionOrderNumber: String
    plantCode: String
    materialCode: String
    materialUom: String
    weight: Float
    uom: String
    weightConverted: Float
    productionGroup: String
    productionShift: Int
    packingGroup: String
    packingShift: Int
    productionLot: String
    productionLocation: String
    storageLocation: String
    transactionType: String
    isSummarized: Boolean
  }

  type ScaleResults {
    id: Int!
    scaleTransactionId: String
    scaleId: String
    productionOrderNumber: String
    plantCode: String
    materialCode: String
    materialUom: String
    weight: Float
    uom: String
    weightConverted: Float
    productionGroup: String
    productionShift: Int
    packingGroup: String
    packingShift: Int
    productionLot: String
    productionLocation: String
    userId: Int
    username: String
    storageLocation: String
    transactionType: String
    isSummarized: Boolean!
    createdAt: DateTime!
  }

  type ScaleResultsPagination {
    scaleResults: [ScaleResults]!
    meta: PaginationMeta!
  }

  input ScaleResultsFilter {
    scaleId: String
    productionOrderNumber: String
    materialCode: String
    productionGroup: String
    packingGroup: String
    productionLot: String
    userId: Int
    username: String
    storageLocation: String
    scaleTransactionId: String
    transactionType: String
    isSummarized: Boolean
    plantCode: String
  }
`;
