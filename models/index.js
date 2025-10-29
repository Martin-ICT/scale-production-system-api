const sequelize = require('../db');
const OrderType = require('./orderType');
const OrderTypeStorageLocation = require('./orderTypeStorageLocation');
const PackingGroup = require('./packingGroup');
const PackingShift = require('./packingShift');
const ProductionGroup = require('./productionGroup');
const ProductionLot = require('./productionLot');
const ProductionOrderDetail = require('./productionOrderDetail');
const ProductionOrderSAP = require('./productionOrderSAP');
const ProductionShift = require('./productionShift');
const Scale = require('./scale');
const ScaleAssignment = require('./scaleAssignment');
const ScaleResults = require('./scaleResults');
const StorageLocation = require('./storageLocation');
const WeightSummaryBatch = require('./weightSummaryBatch');
const WeightSummaryBatchItem = require('./weightSummaryBatchItem');
// const ProductionPlanning = require('./productionPlanning');
// const ProductionPlanningLine = require('./productionPlanningLine');

const models = {
  OrderType,
  OrderTypeStorageLocation,
  PackingGroup,
  PackingShift,
  ProductionGroup,
  ProductionLot,
  ProductionOrderDetail,
  ProductionOrderSAP,
  ProductionShift,
  Scale,
  ScaleAssignment,
  ScaleResults,
  StorageLocation,
  WeightSummaryBatch,
  WeightSummaryBatchItem,
};

Object.keys(models).forEach((modelName) => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

models.sequelize = sequelize;
models.Sequelize = sequelize.Sequelize;

module.exports = models;
