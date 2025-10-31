const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');
const dayjs = require('dayjs');

const ScaleAssignment = sequelize.define(
  'scale_assignment',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    scaleId: {
      field: 'scale_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'scale',
        key: 'id',
      },
    },
    productionOrderDetailId: {
      field: 'production_order_detail_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'production_order_detail',
        key: 'id',
      },
    },
    createdAt: {
      field: 'created_at',
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
      allowNull: false,
    },
    updatedAt: {
      field: 'updated_at',
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
      allowNull: false,
    },
    deletedAt: {
      field: 'deleted_at',
      type: DataTypes.DATE,
    },
  },
  {
    freezeTableName: true,
    tableName: 'scale_assignment',
    paranoid: true,
  }
);

ScaleAssignment.associate = (models) => {
  ScaleAssignment.belongsTo(models.Scale, {
    foreignKey: 'scaleId',
    as: 'scale',
  });
  ScaleAssignment.belongsTo(models.ProductionOrderDetail, {
    foreignKey: 'productionOrderDetailId',
    as: 'productionOrderDetail',
  });
};

module.exports = ScaleAssignment;
