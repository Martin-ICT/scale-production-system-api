const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');

const Scale = sequelize.define(
  'scale',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    deviceIP: {
      field: 'device_ip',
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    deviceId: {
      field: 'device_id',
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    brand: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    plantCode: {
      field: 'plant_code',
      type: DataTypes.STRING,
      allowNull: true,
    },
    uom: {
      type: DataTypes.ENUM('kg', 'g'),
      allowNull: false,
    },
    capacity: {
      type: DataTypes.ENUM('3', '6', '9', '12', '15'),
      allowNull: false,
      comment: 'Scale capacity in kilograms',
    },
    lastCalibrate: {
      field: 'last_calibrate',
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: {
      field: 'created_at',
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
      allowNull: false,
    },
    updatedAt: {
      field: 'updated_at',
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
      allowNull: false,
    },
    deletedAt: {
      field: 'deleted_at',
      type: DataTypes.DATE,
    },
  },
  {
    freezeTableName: true,
    tableName: 'scale',
    paranoid: true,
  }
);

Scale.associate = (models) => {
  Scale.hasMany(models.ScaleAssignment, {
    foreignKey: 'scaleId',
    as: 'scaleAssignments',
  });
};

module.exports = Scale;
