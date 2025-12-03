const { DataTypes } = require('sequelize');
const sequelizeWms = require('../dbWms');

const MaterialOrderType = sequelizeWms.define(
  'ad_org_product',
  {
    id: {
      field: 'ad_org_product_id',
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    clientId: {
      field: 'ad_client_id',
      type: DataTypes.INTEGER,
    },
    materialId: {
      field: 'm_product_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'm_product',
        key: 'm_product_id',
      },
    },
    minWeight: {
      field: 'z_lower',
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    maxWeight: {
      field: 'z_upper',
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    orderTypeId: {
      field: 'z_order_type_id',
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'c_elementvalue',
        key: 'c_elementvalue_id',
      },
    },
  },
  {
    freezeTableName: true,
    tableName: 'ad_org_product',
    timestamps: false,
  }
);

module.exports = MaterialOrderType;
