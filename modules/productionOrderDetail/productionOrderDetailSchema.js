const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    productionOrderDetailList(
      page: Int
      pageSize: Int
      search: String
      filter: ProductionOrderDetailFilter
      sort: SortBy
    ): ProductionOrderDetailPagination!
    productionOrderDetailDetail(id: ID!): ProductionOrderDetail
    productionOrderDetailListByProductionOrder(
      productionOrderId: ID!
      page: Int
      pageSize: Int
      sort: SortBy
    ): ProductionOrderDetailPagination!
    productionOrderDetailListByScaleIP(
      deviceIP: String!
      page: Int
      pageSize: Int
      sort: SortBy
    ): ProductionOrderDetailPagination!
  }

  extend type Mutation {
    productionOrderDetailCreate(
      input: ProductionOrderDetailInputCreate!
    ): ProductionOrderDetail
    productionOrderDetailUpdate(
      id: ID!
      input: ProductionOrderDetailInputUpdate!
    ): ProductionOrderDetail
    productionOrderDetailUpdateTotalWeighed(
      id: ID!
      totalWeighed: Float!
      totalWeighedGoodReceive: Float
      weighingCount: Int
    ): ProductionOrderDetail
    productionOrderDetailDelete(id: ID!): Boolean
  }

  input ProductionOrderDetailInputCreate {
    productionOrderId: Int!
    materialCode: String!
    targetWeight: Int!
    totalWeighed: Float
    totalWeighedGoodReceive: Float
    weighingCount: Int
  }

  input ProductionOrderDetailInputUpdate {
    materialCode: String
    targetWeight: Int
    totalWeighed: Float
    totalWeighedGoodReceive: Float
    weighingCount: Int
  }

  type ProductionOrderDetail {
    id: Int!
    productionOrderId: Int!
    materialCode: String!
    materialDescription: String!
    materialUom: String!
    targetWeight: Int!
    processingType: Int!
    orderTypeId: Int
    totalWeighed: Float!
    totalWeighedGoodReceive: Float!
    weighingCount: Int!
    createdBy: Int
    updatedBy: Int
    createdAt: DateTime!
    updatedAt: DateTime!
    deletedAt: DateTime
    productionOrderSAP: ProductionOrderSAP
    orderType: OrderType
  }

  type ProductionOrderDetailPagination {
    productionOrderDetails: [ProductionOrderDetail]!
    meta: PaginationMeta!
  }

  input ProductionOrderDetailFilter {
    productionOrderId: Int
    materialCode: String
    processingType: Int
    orderTypeId: Int
    scaleId: ID
  }
`;
