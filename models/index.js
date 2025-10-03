const sequelize = require('../db');
const Company = require('./company');
const Plant = require('./plant');
const Scale = require('./scale');

const models = {
  Company,
  Plant,
  Scale,
};

Object.keys(models).forEach((modelName) => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

models.sequelize = sequelize;
models.Sequelize = sequelize.Sequelize;

module.exports = models;
