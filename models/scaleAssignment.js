const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');
const dayjs = require('dayjs');

const ScaleAssignment = sequelize.define(
  'scale_assignment',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    location: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      field: 'created_at',
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
      allowNull: false,
      get() {
        const rawValue = this.getDataValue('createdAt');
        return rawValue ? dayjs(rawValue).format('YYYY-MM-DD HH:mm:ss') : null;
      },
    },
    updatedAt: {
      field: 'updated_at',
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
      allowNull: false,
      get() {
        const rawValue = this.getDataValue('updatedAt');
        return rawValue ? dayjs(rawValue).format('YYYY-MM-DD HH:mm:ss') : null;
      },
    },
  },
  {
    freezeTableName: true,
    tableName: 'scale',
    timestamps: true,
  }
);

module.exports = ScaleAssignment;

