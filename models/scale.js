const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');
const dayjs = require('dayjs');

const Scale = sequelize.define(
  'scale',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    deviceId: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    plantId: {
      field: 'plant_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'plant',
        key: 'id',
      },
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
    paranoid: true,
    indexes: [
      {
        unique: true,
        fields: ['code', 'company_id'],
      },
    ],
  }
);

Scale.associate = (models) => {
  Scale.belongsTo(models.Plant, { foreignKey: 'plantId', as: 'plant' });
};

module.exports = Scale;

