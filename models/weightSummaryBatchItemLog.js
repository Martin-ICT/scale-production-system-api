const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');

const WeightSummaryBatchItemLog = sequelize.define(
  'weight_summary_batch_item_log',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    idFrom: {
      field: 'id_from',
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'weight_summary_batch_item',
        key: 'id',
      },
      comment: 'ID dari weight_summary_batch_item yang menjadi sumber',
    },
    idTo: {
      field: 'id_to',
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'weight_summary_batch_item',
        key: 'id',
      },
      comment: 'ID ke weight_summary_batch_item yang menjadi tujuan',
    },
    operation: {
      field: 'operation',
      type: DataTypes.ENUM('split', 'merge', 'edit', 'createFromFailed'),
      allowNull: false,
      comment: 'Jenis operasi: split, merge, edit, atau createFromFailed',
    },
    createdBy: {
      field: 'created_by',
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    createdAt: {
      field: 'created_at',
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
      allowNull: false,
    },
  },
  {
    freezeTableName: true,
    tableName: 'weight_summary_batch_item_log',
    timestamps: true,
    updatedAt: false, // Only createdAt, no updatedAt
    paranoid: false, // No soft delete
  }
);

WeightSummaryBatchItemLog.associate = (models) => {
  WeightSummaryBatchItemLog.belongsTo(models.WeightSummaryBatchItem, {
    foreignKey: 'idFrom',
    as: 'fromItem',
  });
  WeightSummaryBatchItemLog.belongsTo(models.WeightSummaryBatchItem, {
    foreignKey: 'idTo',
    as: 'toItem',
  });
  WeightSummaryBatchItemLog.hasMany(models.WeightSummaryBatchItemLogDetail, {
    foreignKey: 'weightSummaryBatchItemLogId',
    as: 'details',
  });
};

module.exports = WeightSummaryBatchItemLog;
