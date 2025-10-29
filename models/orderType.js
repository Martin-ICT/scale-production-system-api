const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');

const OrderType = sequelize.define(
  'order_type',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(2),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    processType: {
      field: 'process_type',
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    maxDay: {
      field: 'max_day',
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    freezeTableName: true,
    tableName: 'order_type',
    timestamps: true,
    paranoid: true,
  }
);

OrderType.associate = (models) => {
  OrderType.belongsToMany(models.StorageLocation, {
    through: models.OrderTypeStorageLocation,
    foreignKey: 'orderTypeId',
    as: 'storageLocations',
  });
};

module.exports = OrderType;
