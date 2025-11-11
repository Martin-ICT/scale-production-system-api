const { DataTypes } = require('sequelize');
const sequelizeWms = require('../dbWms');

const Organization = sequelizeWms.define(
  'ad_org',
  {
    id: {
      field: 'ad_org_id',
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    code: {
      field: 'value',
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    productionLocationId: {
      field: 'z_production_location_id',
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
    tableName: 'ad_org',
    timestamps: false, // Disable automatic timestamp fields
  }
);

module.exports = Organization;
