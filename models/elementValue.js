const { DataTypes } = require('sequelize');
const sequelizeWms = require('../dbWms');

const ElementValue = sequelizeWms.define(
  'c_elementvalue',
  {
    id: {
      field: 'c_elementvalue_id',
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    clientId: {
      field: 'ad_client_id',
      type: DataTypes.INTEGER,
    },
    code: {
      field: 'value',
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    freezeTableName: true,
    tableName: 'c_elementvalue',
    timestamps: false,
  }
);

module.exports = ElementValue;
