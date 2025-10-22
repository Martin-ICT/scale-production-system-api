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
  }

  input ProductionOrderSAPInputCreate {
    productionOrderNumber: String!
    plantCode: String!
    orderTypeCode: Int!
    materialCode: String!
    targetWeight: Int!
    productionDate: DateTime!
  }

  type ProductionOrderSAP {
    id: Int!
    productionOrderNumber: String!
    plantCode: String!
    orderTypeCode: Int!
    materialCode: String!
    targetWeight: Int!
    productionDate: DateTime!
    createdAt: DateTime!
  }

  type ProductionOrderSAPPagination {
    productionOrderSAPs: [ProductionOrderSAP]!
    meta: PaginationMeta!
  }

  input ProductionOrderSAPFilter {
    plantCode: String
    materialCode: String
    orderTypeCode: Int
  }
`;
