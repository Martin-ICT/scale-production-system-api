const { gql } = require('apollo-server');
const scaleSchema = require('./modules/scale/scaleSchema');
const scaleAssignmentSchema = require('./modules/scaleAssignment/scaleAssignmentSchema');
const productionOrderSAPSchema = require('./modules/productionOrderSAP/productionOrderSAPSchema');
const productionOrderDetailSchema = require('./modules/productionOrderDetail/productionOrderDetailSchema');
const packingGroupSchema = require('./modules/packingGroup/packingGroupSchema');
const packingShiftSchema = require('./modules/packingShift/packingShiftSchema');
const productionLotSchema = require('./modules/productionLot/productionLotSchema');
const productionGroupSchema = require('./modules/productionGroup/productionGroupSchema');
const productionShiftSchema = require('./modules/productionShift/productionShiftSchema');
const storageLocationSchema = require('./modules/storageLocation/storageLocationSchema');
const orderTypeSchema = require('./modules/orderType/orderTypeSchema');
const materialSchema = require('./modules/material/materialSchema');
const materialOrderTypeSchema = require('./modules/materialOrderType/materialOrderTypeSchema');
const elementValueSchema = require('./modules/elementValue/elementValueSchema');
const authSchema = require('./modules/auth/authSchema');

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
  type Query
  type Mutation
  ${authSchema}
  ${scaleSchema}
  ${scaleAssignmentSchema}
  ${productionOrderSAPSchema}
  ${productionOrderDetailSchema}
  ${packingGroupSchema}
  ${packingShiftSchema}
  ${productionLotSchema}
  ${productionGroupSchema}
  ${productionShiftSchema}
  ${storageLocationSchema}
  ${orderTypeSchema}
  ${materialSchema}
  ${materialOrderTypeSchema}
  ${elementValueSchema}
  ${dateFilterSchema}
  ${paginationSchema}
  ${sortSchema}
  ${searchSchema}
  ${statusSchema}
`;
