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
      unique: true,
    },
    productionOrderType: {
      field: 'production_order_type',
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    plantCode: {
      field: 'plant_code',
      type: DataTypes.STRING,
      allowNull: false,
    },
    productionLocation: {
      field: 'production_location',
      type: DataTypes.STRING,
      allowNull: false,
    },
    processType: {
      field: 'process_type',
      type: DataTypes.STRING,
      allowNull: false,
    },
    orderType: {
      field: 'order_type',
      type: DataTypes.STRING,
      allowNull: false,
    },
    materialCode: {
      field: 'material_code',
      type: DataTypes.STRING,
      allowNull: false,
    },
    qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    uom: {
      type: DataTypes.STRING,
      allowNull: false,
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
    tableName: 'production_order_SAP',
    paranoid: true,
  }
);

module.exports = ProductionOrderSAP;
