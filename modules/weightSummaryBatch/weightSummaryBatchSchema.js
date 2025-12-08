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
    weightSummaryBatchUpdateStatus(
      id: ID!
      input: WeightSummaryBatchInputUpdateStatus!
    ): WeightSummaryBatch
    weightSummaryBatchDelete(id: ID!): Boolean
    weightSummaryBatchCreateFromScaleResults: [WeightSummaryBatch!]!
    sendWeightSummaryBatchItemToSAP(id: ID!): WeightSummaryBatch
    weightSummaryBatchItemUpdate(
      id: ID!
      input: WeightSummaryBatchItemInputUpdate!
    ): WeightSummaryBatchItem
    weightSummaryBatchItemUpdateStatusMultiple(
      ids: [ID!]!
      status: WeightSummaryBatchItemStatus!
    ): [WeightSummaryBatchItem!]!
    weightSummaryBatchItemUpdateForSAP(
      items: [WeightSummaryBatchItemUpdateForSAPInput!]!
    ): [WeightSummaryBatchItem!]!
  }

  input WeightSummaryBatchItemInputUpdate {
    productionOrderNumber: String
    plantCode: String
    materialCode: String
    materialUom: String
    totalWeight: Float
    totalWeightConverted: Float
    productionGroup: String
    productionShift: Int
    packingGroup: String
    packingShift: Int
    productionLot: String
    productionLocation: String
    storageLocation: String
    storageLocationTarget: String
    packingDate: DateTime
  }

  input WeightSummaryBatchItemUpdateForSAPInput {
    id: ID!
    status: WeightSummaryBatchItemStatus!
    materialDocument: String
  }

  enum WeightSummaryBatchSendToSAP {
    PENDING
    PROCESSED
    SENDING
    FAILED
    SUCCESS
  }

  enum WeightSummaryBatchItemStatus {
    PENDING
    SUCCESS
    FAILED
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

  input WeightSummaryBatchInputUpdateStatus {
    sendToSAP: WeightSummaryBatchSendToSAP
  }

  type WeightSummaryBatch {
    id: ID!
    scaleResultIdFrom: Int
    scaleResultIdTo: Int
    productionOrderDetailId: Int
    batchId: String
    sendToSAP: WeightSummaryBatchSendToSAP
    productionOrderNumber: String
    productionOrderDetail: ProductionOrderDetail
    WeightSummaryBatchItems: [WeightSummaryBatchItem]
    createdAt: DateTime!
    updatedAt: DateTime!
    deletedAt: DateTime
  }

  type WeightSummaryBatchItem {
    id: ID!
    productionOrderNumber: String!
    plantCode: String!
    materialCode: String!
    materialUom: String
    totalWeight: Float
    totalWeightConverted: Float
    productionGroup: String
    productionShift: Int
    packingGroup: String
    packingShift: Int
    productionLot: String
    productionLocation: String
    storageLocation: String
    storageLocationTarget: String
    weightSummaryBatchId: Int
    packingDate: DateTime
    materialDocument: String
    status: WeightSummaryBatchItemStatus
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
    sendToSAP: [WeightSummaryBatchSendToSAP]
    date: DateFilter
  }
`;
