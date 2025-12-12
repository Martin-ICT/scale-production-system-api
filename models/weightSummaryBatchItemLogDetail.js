const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');

const WeightSummaryBatchItemLogDetail = sequelize.define(
  'weight_summary_batch_item_log_detail',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    weightSummaryBatchItemLogId: {
      field: 'weight_summary_batch_item_log_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'weight_summary_batch_item_log',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'Foreign key ke weight_summary_batch_item_log',
    },
    weightSummaryBatchItemId: {
      field: 'weight_summary_batch_item_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'weight_summary_batch_item',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'Foreign key ke weight_summary_batch_item',
    },
    beforeData: {
      field: 'before_data',
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Data sebelum perubahan dalam format JSON',
    },
    afterData: {
      field: 'after_data',
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Data setelah perubahan dalam format JSON',
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
  },
  {
    freezeTableName: true,
    tableName: 'weight_summary_batch_item_log_detail',
    timestamps: true,
    paranoid: false, // No soft delete
  }
);

WeightSummaryBatchItemLogDetail.associate = (models) => {
  WeightSummaryBatchItemLogDetail.belongsTo(models.WeightSummaryBatchItemLog, {
    foreignKey: 'weightSummaryBatchItemLogId',
    as: 'log',
  });
  WeightSummaryBatchItemLogDetail.belongsTo(models.WeightSummaryBatchItem, {
    foreignKey: 'weightSummaryBatchItemId',
    as: 'item',
  });
};

module.exports = WeightSummaryBatchItemLogDetail;

