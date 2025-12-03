const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');

const WeightSummaryBatchItem = sequelize.define(
  'weight_summary_batch_item',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    productionOrderNumber: {
      field: 'production_order_number',
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    plantCode: {
      field: 'plant_code',
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    materialCode: {
      field: 'material_code',
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    materialUom: {
      field: 'material_uom',
      type: DataTypes.STRING(10),
      allowNull: true,
    },

    totalWeight: {
      field: 'total_weight',
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
      defaultValue: 0,
    },
    totalWeightConverted: {
      field: 'total_weight_converted',
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
      defaultValue: 0,
    },
    productionGroup: {
      field: 'production_group',
      type: DataTypes.STRING(2),
      allowNull: true,
    },
    productionShift: {
      field: 'production_shift',
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    packingGroup: {
      field: 'packing_group',
      type: DataTypes.STRING(2),
      allowNull: true,
    },
    packingShift: {
      field: 'packing_shift',
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    productionLot: {
      field: 'production_lot',
      type: DataTypes.STRING(2),
      allowNull: true,
    },
    productionLocation: {
      field: 'production_location',
      type: DataTypes.STRING(2),
      allowNull: true,
    },
    storageLocation: {
      field: 'storage_location',
      type: DataTypes.STRING(4),
      allowNull: true,
    },
    storageLocationTarget: {
      field: 'storage_location_target',
      type: DataTypes.STRING(4),
      allowNull: true,
    },
    weightSummaryBatchId: {
      field: 'weight_summary_batch_id',
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'weight_summary_batch',
        key: 'id',
      },
    },
    packingDate: {
      field: 'packing_date',
      type: DataTypes.DATE,
      allowNull: true,
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
    tableName: 'weight_summary_batch_item',
    paranoid: true,
  }
);

WeightSummaryBatchItem.associate = (models) => {
  WeightSummaryBatchItem.belongsTo(models.WeightSummaryBatch, {
    foreignKey: 'weightSummaryBatchId',
    as: 'weightSummaryBatch',
  });
};

module.exports = WeightSummaryBatchItem;
