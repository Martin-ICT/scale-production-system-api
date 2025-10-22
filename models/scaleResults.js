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
    scaleAssignmentId: {
      field: 'scale_assignment_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'scale_assignment',
        key: 'id',
      },
    },
    recipient: {
      type: DataTypes.STRING,
      allowNull: false,
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
    tableName: 'scale_results',
    paranoid: true,
  }
);

ScaleResults.associate = (models) => {
  ScaleResults.belongsTo(models.ScaleAssignment, {
    foreignKey: 'scaleAssignmentId',
    as: 'scaleAssignment',
  });
};

module.exports = ScaleResults;
