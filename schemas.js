const { gql } = require('apollo-server');
const plantSchema = require('./modules/plant/plantSchema');
const scaleSchema = require('./modules/scale/scaleSchema');
const productionOrderSAPSchema = require('./modules/productionOrderSAP/productionOrderSAPSchema');
const packingGroupSchema = require('./modules/packingGroup/packingGroupSchema');
const packingShiftSchema = require('./modules/packingShift/packingShiftSchema');
const productionLotSchema = require('./modules/productionLot/productionLotSchema');
const productionGroupSchema = require('./modules/productionGroup/productionGroupSchema');
const productionShiftSchema = require('./modules/productionShift/productionShiftSchema');
const storageLocationSchema = require('./modules/storageLocation/storageLocationSchema');

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
  ${scaleSchema}
  ${productionOrderSAPSchema}
  ${packingGroupSchema}
  ${packingShiftSchema}
  ${productionLotSchema}
  ${productionGroupSchema}
  ${productionShiftSchema}
  ${storageLocationSchema}
  ${dateFilterSchema}
  ${paginationSchema}
  ${sortSchema}
  ${searchSchema}
  ${statusSchema}
`;
