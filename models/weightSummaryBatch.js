const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');

// Helper function to generate batch ID
const generateBatchId = async (plantCode, model) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateString = `${year}${month}${day}`;

  const prefix = `SUM${plantCode}${dateString}`;

  // Find the highest batch ID for today with the same plant code
  const lastBatch = await model.findOne({
    where: {
      batchId: {
        [Sequelize.Op.like]: `${prefix}%`,
      },
    },
    order: [['batchId', 'DESC']],
  });

  let nextNumber = 1;
  if (lastBatch) {
    const lastBatchId = lastBatch.batchId;
    const lastNumber = parseInt(lastBatchId.substring(prefix.length));
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
};

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
    // plantCode: {
    //   field: 'plant_code',
    //   type: DataTypes.STRING(10),
    //   allowNull: false,
    // },
    // productionOrderDetailId: {
    //   field: 'production_order_number',
    //   type: DataTypes.STRING(20),
    //   allowNull: false,
    // },
    productionOrderDetailId: {
      field: 'production_order_detail_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'production_order_detail',
        key: 'id',
      },
    },
    // materialCode: {
    //   field: 'material_code',
    //   type: DataTypes.STRING(10),
    //   allowNull: false,
    // },
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

// Hook to auto-generate batch ID before creating
WeightSummaryBatch.beforeCreate(async (instance) => {
  if (!instance.batchId && instance.plantCode) {
    instance.batchId = await generateBatchId(
      instance.plantCode,
      WeightSummaryBatch
    );
  }
});

WeightSummaryBatch.associate = (models) => {
  WeightSummaryBatch.belongsTo(models.ProductionOrderDetail, {
    foreignKey: 'productionOrderDetailId',
    as: 'productionOrderDetail',
  });
};

module.exports = WeightSummaryBatch;
