const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    weightSummaryBatchList(
      page: Int
      pageSize: Int
      search: String
      filter: WeightSummaryBatchFilter
      sort: SortBy
    ): WeightSummaryBatchPagination!
    weightSummaryBatchDetail(id: ID!): WeightSummaryBatch
  }

  extend type Mutation {
    weightSummaryBatchCreate(
      input: WeightSummaryBatchInputCreate!
    ): WeightSummaryBatch
    weightSummaryBatchUpdate(
      id: ID!
      input: WeightSummaryBatchInputUpdate!
    ): WeightSummaryBatch
    weightSummaryBatchDelete(id: ID!): Boolean
    weightSummaryBatchCreateFromScaleResults(
      input: WeightSummaryBatchFromScaleResultsInput!
    ): [WeightSummaryBatch!]!
  }

  enum WeightSummaryBatchSendToSAP {
    PENDING
    PROCESSED
    SENDING
    FAILED
    SUCCESS
  }

  input WeightSummaryBatchInputCreate {
    scaleResultIdFrom: Int!
    scaleResultIdTo: Int!
    productionOrderDetailId: Int!
    batchId: String
    sendToSAP: WeightSummaryBatchSendToSAP
    plantCode: String
  }

  input WeightSummaryBatchInputUpdate {
    scaleResultIdFrom: Int
    scaleResultIdTo: Int
    productionOrderDetailId: Int
    batchId: String
    sendToSAP: WeightSummaryBatchSendToSAP
  }

  type WeightSummaryBatch {
    id: ID!
    scaleResultIdFrom: Int
    scaleResultIdTo: Int
    productionOrderDetailId: Int
    batchId: String
    sendToSAP: WeightSummaryBatchSendToSAP
    productionOrderDetail: ProductionOrderDetail
    createdAt: DateTime!
    updatedAt: DateTime!
    deletedAt: DateTime
  }

  type WeightSummaryBatchPagination {
    weightSummaryBatches: [WeightSummaryBatch]!
    meta: PaginationMeta!
  }

  input WeightSummaryBatchFilter {
    scaleResultIdFrom: Int
    scaleResultIdTo: Int
    productionOrderDetailId: Int
    batchId: String
    sendToSAP: WeightSummaryBatchSendToSAP
    date: DateFilter
  }

  input WeightSummaryBatchFromScaleResultsInput {
    productionOrderNumber: String!
    sendToSAP: WeightSummaryBatchSendToSAP
  }
`;
