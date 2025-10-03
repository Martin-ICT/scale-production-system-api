const sequelize = require('../db');
const Company = require('./company');
const Plant = require('./plant');
const Scale = require('./scale');
const ScaleAssignment = require('./scaleAssignment');
const Material = require('./material');
const ProductionOrder = require('./productionOrder');
const ProductionOrderLine = require('./productionOrderLine');
const ProductionOrderSAP = require('./productionOrderSAP');

const models = {
  Company,
  Plant,
  Scale,
  ScaleAssignment,
  Material,
  ProductionOrder,
  ProductionOrderLine,
  ProductionOrderSAP,
};

Object.keys(models).forEach((modelName) => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

models.sequelize = sequelize;
models.Sequelize = sequelize.Sequelize;

module.exports = models;
