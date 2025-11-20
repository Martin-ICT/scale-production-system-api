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

// Create partial unique index for active records only (deleted_at IS NULL)
// NOTE: Before creating this index, you need to remove duplicate records first.
// Run this SQL to remove duplicates (keeps the record with the lowest id):
//
// DELETE FROM production_order_detail a
// USING production_order_detail b
// WHERE a.id > b.id
//   AND a.production_order_id = b.production_order_id
//   AND a.material_code = b.material_code
//   AND a.deleted_at IS NULL
//   AND b.deleted_at IS NULL;
//
// Then create the partial unique index:
// CREATE UNIQUE INDEX IF NOT EXISTS unique_production_order_detail_material
// ON production_order_detail (production_order_id, material_code)
// WHERE deleted_at IS NULL;

ProductionOrderDetail.afterSync(async () => {
  try {
    // First, try to remove duplicates (keeps the record with the lowest id)
    await sequelize.query(`
      DELETE FROM production_order_detail a
      USING production_order_detail b
      WHERE a.id > b.id
        AND a.production_order_id = b.production_order_id
        AND a.material_code = b.material_code
        AND a.deleted_at IS NULL
        AND b.deleted_at IS NULL;
    `);

    // Then create the partial unique index
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_production_order_detail_material 
      ON production_order_detail (production_order_id, material_code) 
      WHERE deleted_at IS NULL;
    `);
  } catch (error) {
    // Index might already exist or other error, log it
    if (!error.message.includes('already exists')) {
      console.error('Error creating partial unique index:', error.message);
    }
  }
});

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
