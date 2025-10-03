const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');
const dayjs = require('dayjs');

const ScaleResults = sequelize.define(
  'scale_results',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    scaleId: {
      field: 'scale_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'scale',
        key: 'id',
      },
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
    plantId: {
      field: 'plant_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'plant',
        key: 'id',
      },
    },
    scaleBy: {
      field: 'scale_by',
      type: DataTypes.INTEGER,
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
    paranoid: true,
    indexes: [
      {
        unique: true,
        fields: ['device_id', 'plant_id'],
      },
    ],
  }
);

ScaleResults.associate = (models) => {
  ScaleResults.belongsTo(models.Scale, { foreignKey: 'scaleId', as: 'scale' });

  ScaleResults.hasMany(models.ScaleResultsAssignment, {
    foreignKey: 'scaleId',
    as: 'scaleAssignments',
  });
};

module.exports = ScaleResults;
