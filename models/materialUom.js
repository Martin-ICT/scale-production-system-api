const { DataTypes } = require('sequelize');
const sequelizeWms = require('../dbWms');

const MaterialUom = sequelizeWms.define(
  'c_uom',
  {
    id: {
      field: 'c_uom_id',
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    clientId: {
      field: 'ad_client_id',
      type: DataTypes.INTEGER,
    },
    code: {
      field: 'uomsymbol',
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    freezeTableName: true,
    tableName: 'c_uom',
  }
);

MaterialUom.associate = (models) => {
  MaterialUom.hasMany(models.Material, {
    foreignKey: 'uomId',
    as: 'materials',
  });
};

module.exports = MaterialUom;
