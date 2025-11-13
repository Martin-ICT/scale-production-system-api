const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');

// Helper function to generate batch ID

const WeightSummaryBatch = sequelize.define(
  'weight_summary_batch',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    scaleResultIdFrom: {
      field: 'scale_result_id_from',
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    scaleResultIdTo: {
      field: 'scale_result_id_to',
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    productionOrderDetailId: {
      field: 'production_order_detail_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'production_order_detail',
        key: 'id',
      },
    },
    batchId: {
      field: 'batch_id',
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    sendToSAP: {
      field: 'send_to_sap',
      type: DataTypes.ENUM(
        'pending',
        'processed',
        'sending',
        'failed',
        'success'
      ),
      defaultValue: 'pending',
      allowNull: false,
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
    tableName: 'weight_summary_batch',
    timestamps: true,
    paranoid: true,
  }
);

WeightSummaryBatch.associate = (models) => {
  WeightSummaryBatch.belongsTo(models.ProductionOrderDetail, {
    foreignKey: 'productionOrderDetailId',
    as: 'productionOrderDetail',
  });
};

module.exports = WeightSummaryBatch;
