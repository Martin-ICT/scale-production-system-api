const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');
const dayjs = require('dayjs');

const StorageLocation = sequelize.define(
  'storage_location',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    freezeTableName: true,
    tableName: 'storage_location',
    timestamps: false,
  }
);

StorageLocation.associate = (models) => {
  StorageLocation.belongsToMany(models.OrderType, {
    through: models.OrderTypeStorageLocation,
    foreignKey: 'storageLocationId',
    as: 'orderTypes',
  });
};

module.exports = StorageLocation;
