const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');

const ProductionOrderDetail = sequelize.define(
  'production_order_detail',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    productionOrderId: {
      field: 'production_order_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'production_order_SAP',
        key: 'id',
      },
    },
    materialCode: {
      field: 'material_code',
      type: DataTypes.STRING,
      allowNull: false,
    },
    materialDescription: {
      field: 'material_description',
      type: DataTypes.STRING,
      allowNull: false,
    },
    materialUom: {
      field: 'material_uom',
      type: DataTypes.STRING,
      allowNull: false,
    },
    targetWeight: {
      field: 'target_weight',
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    processingType: {
      field: 'processing_type',
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    orderTypeId: {
      field: 'order_type_id',
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'order_type',
        key: 'id',
      },
    },
    totalWeighed: {
      field: 'total_weighed',
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
    },
    totalWeighedGoodReceive: {
      field: 'total_weighed_good_receive',
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
    },
    weighingCount: {
      field: 'weighing_count',
      type: DataTypes.INTEGER,
      defaultValue: 0,
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
    tableName: 'production_order_detail',
    paranoid: true,
  }
);

ProductionOrderDetail.associate = (models) => {
  ProductionOrderDetail.belongsTo(models.ProductionOrderSAP, {
    foreignKey: 'productionOrderId',
    as: 'productionOrderSAP',
  });

  ProductionOrderDetail.belongsTo(models.OrderType, {
    foreignKey: 'orderTypeId',
    as: 'orderType',
  });

  ProductionOrderDetail.hasMany(models.WeightSummaryBatch, {
    foreignKey: 'productionOrderDetailId',
    as: 'weightSummaryBatches',
  });

  ProductionOrderDetail.hasMany(models.ScaleAssignment, {
    foreignKey: 'productionOrderDetailId',
    as: 'scaleAssignments',
  });
};

module.exports = ProductionOrderDetail;
