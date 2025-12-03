const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');
const dayjs = require('dayjs');

const StorageLocationTarget = sequelize.define(
  'storage_location_target',
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
    tableName: 'storage_location_target',
    timestamps: false,
  }
);

StorageLocationTarget.associate = (models) => {
  StorageLocationTarget.belongsToMany(models.OrderType, {
    through: models.OrderTypeStorageLocationTarget,
    foreignKey: 'storageLocationTargetId',
    as: 'orderTypes',
  });
};

module.exports = StorageLocationTarget;

