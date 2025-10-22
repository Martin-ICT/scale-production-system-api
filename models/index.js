const sequelize = require('../db');
const Plant = require('./plant');
const Scale = require('./scale');
const ScaleResults = require('./scaleResults');
const ScaleAssignment = require('./scaleAssignment');
const GoodReceive = require('./goodReceive');
const ProductionOrderSAP = require('./productionOrderSAP');
const ProductionPlanning = require('./productionPlanning');
const ProductionPlanningLine = require('./productionPlanningLine');

//GoodReceive
const PackingGroup = require('./packingGroup');
const PackingShift = require('./packingShift');
const ProductionGroup = require('./productionGroup');
const ProductionShift = require('./productionShift');
const ProductionLot = require('./productionLot');

const OrderType = require('./orderType');
const StorageLocation = require('./storageLocation');

const models = {
  Plant,
  Scale,
  ScaleAssignment,
  ScaleResults,
  GoodReceive,
  PackingShift,
  PackingGroup,
  ProductionGroup,
  ProductionShift,
  ProductionLot,
  ProductionOrderSAP,
  ProductionPlanning,
  ProductionPlanningLine,
  OrderType,
  StorageLocation,
};

Object.keys(models).forEach((modelName) => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

models.sequelize = sequelize;
models.Sequelize = sequelize.Sequelize;

module.exports = models;
