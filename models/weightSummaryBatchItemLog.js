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
    totalWeight: {
      field: 'total_weight',
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
      defaultValue: 0,
      comment: 'Total weight yang dipindahkan',
    },
    totalWeightConverted: {
      field: 'total_weight_converted',
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
      defaultValue: 0,
      comment: 'Total weight converted yang dipindahkan',
    },
    createdBy: {
      field: 'created_by',
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updatedBy: {
      field: 'updated_by',
      type: DataTypes.INTEGER,
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
    tableName: 'weight_summary_batch_item_log',
    timestamps: true,
    paranoid: true,
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
};

module.exports = WeightSummaryBatchItemLog;




