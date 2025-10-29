const { DataTypes } = require('sequelize');
const sequelizeWms = require('../dbWms');

const Material = sequelizeWms.define(
  'm_product',
  {
    id: {
      field: 'm_product_id',
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
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
      allowNull: false,
    },
    uomId: {
      field: 'c_uom_id',
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    freezeTableName: true,
    tableName: 'm_product',
    timestamps: false,
  }
);

Material.associate = (models) => {
  Material.belongsTo(models.MaterialUom, { foreignKey: 'uomId', as: 'uom' });

  Material.belongsToMany(models.ElementValue, {
    through: models.UserRoom,
    foreignKey: 'userId',
    otherKey: 'roomId',
    as: 'userRooms',
  });
};

module.exports = Material;
