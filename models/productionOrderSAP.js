const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');

const ProductionOrderSAP = sequelize.define(
  'production_order_SAP',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    productionOrderNumber: {
      field: 'production_order_number',
      type: DataTypes.STRING,
      allowNull: false,
    },
    plantCode: {
      field: 'plant_code',
      type: DataTypes.STRING,
      allowNull: false,
    },
    orderTypeCode: {
      field: 'order_type_code',
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    materialCode: {
      field: 'material_code',
      type: DataTypes.STRING,
      allowNull: false,
    },
    targetWeight: {
      field: 'target_weight',
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    productionDate: {
      field: 'production_date',
      type: DataTypes.DATE,
      allowNull: false,
    },
    createdAt: {
      field: 'created_at',
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
      allowNull: false,
    },
  },
  {
    freezeTableName: true,
    tableName: 'production_order_SAP',
    indexes: [
      {
        unique: true,
        fields: ['production_order_number', 'material_code'],
        name: 'unique_production_order_material',
      },
    ],
  }
);

module.exports = ProductionOrderSAP;
