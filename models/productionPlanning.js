const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');

const ProductionPlanning = sequelize.define(
  'production_planning',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    plantId: {
      field: 'plant_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'plant',
        key: 'id',
      },
    },
    planDate: {
      field: 'plan_date',
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
      allowNull: false,
      get() {
        const rawValue = this.getDataValue('plantDate');
        return rawValue ? dayjs(rawValue).format('YYYY-MM-DD HH:mm:ss') : null;
      },
    },
    createdAt: {
      field: 'created_at',
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
      allowNull: false,
      get() {
        const rawValue = this.getDataValue('createdAt');
        return rawValue ? dayjs(rawValue).format('YYYY-MM-DD HH:mm:ss') : null;
      },
    },
    updatedAt: {
      field: 'updated_at',
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
      allowNull: false,
      get() {
        const rawValue = this.getDataValue('updatedAt');
        return rawValue ? dayjs(rawValue).format('YYYY-MM-DD HH:mm:ss') : null;
      },
    },
    deletedAt: {
      field: 'deleted_at',
      type: DataTypes.DATE,
    },
  },
  {
    freezeTableName: true,
    tableName: 'production_planning',
    paranoid: true,
  }
);

ProductionPlanning.associate = (models) => {
  ProductionPlanning.hasMany(models.ProductionPlanningLine, {
    foreignKey: 'productionPlanningId',
    as: 'productionPlanning',
  });

  ProductionPlanning.belongsTo(models.Plant, {
    foreignKey: 'plantId',
    as: 'plant',
  });
};

module.exports = ProductionPlanning;
