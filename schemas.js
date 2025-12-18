const { gql } = require('apollo-server');
const scaleSchema = require('./modules/scale/scaleSchema');
const scaleAssignmentSchema = require('./modules/scaleAssignment/scaleAssignmentSchema');
const scaleResultsSchema = require('./modules/scaleResults/scaleResultsSchema');
const productionOrderSAPSchema = require('./modules/productionOrderSAP/productionOrderSAPSchema');
const productionOrderDetailSchema = require('./modules/productionOrderDetail/productionOrderDetailSchema');
const packingGroupSchema = require('./modules/packingGroup/packingGroupSchema');
const packingShiftSchema = require('./modules/packingShift/packingShiftSchema');
const productionLotSchema = require('./modules/productionLot/productionLotSchema');
const productionGroupSchema = require('./modules/productionGroup/productionGroupSchema');
const productionShiftSchema = require('./modules/productionShift/productionShiftSchema');
const plantSchema = require('./modules/plant/plantSchema');
const storageLocationSchema = require('./modules/storageLocation/storageLocationSchema');
const storageLocationTargetSchema = require('./modules/storageLocationTarget/storageLocationTargetSchema');
const orderTypeSchema = require('./modules/orderType/orderTypeSchema');
const materialSchema = require('./modules/material/materialSchema');
const materialOrderTypeSchema = require('./modules/materialOrderType/materialOrderTypeSchema');
const elementValueSchema = require('./modules/elementValue/elementValueSchema');
const authSchema = require('./modules/auth/authSchema');
const weightSummaryBatchSchema = require('./modules/weightSummaryBatch/weightSummaryBatchSchema');
const dashboardSchema = require('./modules/dashboard/dashboardSchema');

//shared
const dateFilterSchema = require('./modules/shared/schemas/dateFilter');
const paginationSchema = require('./modules/shared/schemas/pagination');
const sortSchema = require('./modules/shared/schemas/sort');
const searchSchema = require('./modules/shared/schemas/search');
const statusSchema = require('./modules/shared/schemas/status');

module.exports = gql`
  scalar Upload
  scalar JSON
  scalar Date
  scalar DateTime
  scalar EmailAddress
  scalar PhoneNumber
  scalar Decimal
  type Query
  type Mutation
  ${authSchema}
  ${scaleSchema}
  ${scaleAssignmentSchema}
  ${scaleResultsSchema}
  ${productionOrderSAPSchema}
  ${productionOrderDetailSchema}
  ${packingGroupSchema}
  ${packingShiftSchema}
  ${productionLotSchema}
  ${productionGroupSchema}
  ${productionShiftSchema}
  ${plantSchema}
  ${storageLocationSchema}
  ${storageLocationTargetSchema}
  ${orderTypeSchema}
  ${materialSchema}
  ${materialOrderTypeSchema}
  ${elementValueSchema}
  ${weightSummaryBatchSchema}
  ${dashboardSchema}
  ${dateFilterSchema}
  ${paginationSchema}
  ${sortSchema}
  ${searchSchema}
  ${statusSchema}
`;
