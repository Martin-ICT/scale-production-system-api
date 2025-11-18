const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    productionOrderSAPList(
      page: Int
      pageSize: Int
      search: String
      filter: ProductionOrderSAPFilter
      sort: SortBy
    ): ProductionOrderSAPPagination!
    productionOrderSAPDetail(id: ID!): ProductionOrderSAP
  }

  extend type Mutation {
    productionOrderSAPCreate(
      input: ProductionOrderSAPInputCreate!
    ): ProductionOrderSAP
    productionOrderSAPUpdateStatus(
      productionOrderNumber: String!
      status: Int!
    ): ProductionOrderSAP
  }

  input ProductionOrderSAPInputCreate {
    productionOrderNumber: String!
    plantCode: String!
    orderTypeCode: String!
    materialCode: String!
    targetWeight: Int!
    productionDate: DateTime!
    suitability: Int!
  }

  type ProductionOrderSAP {
    id: Int!
    productionOrderNumber: String
    plantCode: String
    productionLocation: ElementValue
    orderTypeCode: String
    materialCode: String
    materialDescription: String
    targetWeight: Int
    productionDate: DateTime
    productionOrderDetails: [ProductionOrderDetail]
    suitability: Int
    status: Int
    createdAt: DateTime
  }

  type ProductionOrderSAPPagination {
    productionOrderSAPs: [ProductionOrderSAP]!
    meta: PaginationMeta!
  }

  input ProductionOrderSAPFilter {
    productionOrderNumber: String
    plantCode: String
    materialCode: String
    orderTypeCode: String
    status: Int
    scaleId: ID
    date: DateFilter
  }
`;
