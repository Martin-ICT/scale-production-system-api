const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');

const ProductionOrderLine = sequelize.define(
  'production_order_line',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    productionOrderId: {
      field: 'production_order_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'production_order',
        key: 'id',
      },
    },
    orderType: {
      field: 'order_type',
      type: DataTypes.STRING,
      allowNull: false,
    },
    recipient: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    productionGroup: {
      field: 'production_group',
      type: DataTypes.STRING,
      allowNull: false,
    },
    productionLot: {
      field: 'production_lot',
      type: DataTypes.STRING,
      allowNull: false,
    },
    productionShift: {
      field: 'production_shift',
      type: DataTypes.STRING,
      allowNull: false,
    },
    packingGroup: {
      field: 'packing_group',
      type: DataTypes.STRING,
      allowNull: false,
    },
    packingShift: {
      field: 'packing_shift',
      type: DataTypes.STRING,
      allowNull: false,
    },
    packingDate: {
      field: 'packing_date',
      type: DataTypes.DATE,
      allowNull: false,
      get() {
        const rawValue = this.getDataValue('pack_date');
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
    tableName: 'production_order_line',
    paranoid: true,
  }
);

module.exports = ProductionOrderLine;
