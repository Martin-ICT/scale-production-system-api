const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');

const OrderTypeStorageLocation = sequelize.define(
  'order_type_storage_location',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    orderTypeId: {
      field: 'order_type_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'order_type',
        key: 'id',
      },
    },
    storageLocationId: {
      field: 'storage_location_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'storage_location',
        key: 'id',
      },
    },
  },
  {
    freezeTableName: true,
    tableName: 'order_type_storage_location',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['order_type_id', 'storage_location_id'],
        name: 'unique_order_type_storage_location',
      },
    ],
  }
);

OrderTypeStorageLocation.associate = (models) => {
  OrderTypeStorageLocation.belongsTo(models.OrderType, {
    foreignKey: 'orderTypeId',
    as: 'orderType',
  });

  OrderTypeStorageLocation.belongsTo(models.StorageLocation, {
    foreignKey: 'storageLocationId',
    as: 'storageLocation',
  });
};

module.exports = OrderTypeStorageLocation;
