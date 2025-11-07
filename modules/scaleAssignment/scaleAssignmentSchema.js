const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    scaleAssignmentList(
      page: Int
      pageSize: Int
      search: String
      filter: ScaleAssignmentFilter
      sort: SortBy
    ): ScaleAssignmentPagination!
    scaleAssignmentDetail(id: ID!): ScaleAssignment
    scaleAssignmentListByScale(
      scaleId: ID!
      page: Int
      pageSize: Int
      sort: SortBy
    ): ScaleAssignmentPagination!
    scaleAssignmentListByProductionOrderDetail(
      productionOrderDetailId: ID!
      page: Int
      pageSize: Int
      sort: SortBy
    ): ScaleAssignmentPagination!
  }

  extend type Mutation {
    scaleAssignmentCreate(input: ScaleAssignmentInputCreate!): ScaleAssignment
    scaleAssignmentBatchCreate(
      input: ScaleAssignmentInputBatchCreate!
    ): [ScaleAssignment!]!
    scaleAssignmentUpdate(
      id: ID!
      input: ScaleAssignmentInputUpdate!
    ): ScaleAssignment
    scaleAssignmentDelete(id: ID!): Boolean
  }

  input ScaleAssignmentInputCreate {
    scaleId: Int!
    productionOrderDetailId: Int!
  }

  input ScaleAssignmentInputBatchCreate {
    scaleId: Int!
    productionOrderDetailIds: [Int!]!
  }

  input ScaleAssignmentInputUpdate {
    scaleId: Int
    productionOrderDetailId: Int
  }

  type ScaleAssignment {
    id: Int!
    scaleId: Int!
    productionOrderDetailId: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
    deletedAt: DateTime
    scale: Scale
    productionOrderDetail: ProductionOrderDetail
  }

  type ScaleAssignmentPagination {
    scaleAssignments: [ScaleAssignment]!
    meta: PaginationMeta!
  }

  input ScaleAssignmentFilter {
    scaleId: Int
    productionOrderDetailId: Int
  }
`;
