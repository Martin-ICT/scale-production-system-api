const { DataTypes, QueryTypes } = require('sequelize');
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
    scaleTransactionId: {
      field: 'scale_transaction_id',
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    scaleId: {
      field: 'scale_id',
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    productionOrderNumber: {
      field: 'production_order_number',
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    plantCode: {
      field: 'plant_code',
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    materialCode: {
      field: 'material_code',
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    materialUom: {
      field: 'material_uom',
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    weight: {
      field: 'weight',
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    uom: {
      field: 'uom',
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    weightConverted: {
      field: 'weight_converted',
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    materialMeasurementType: {
      field: 'material_measurement_type',
      type: DataTypes.ENUM('actual', 'standard'),
      allowNull: true,
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
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    packingShift: {
      field: 'packing_shift',
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    productionLot: {
      field: 'production_lot',
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    productionLocation: {
      field: 'production_location',
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    userId: {
      field: 'user_id',
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    username: {
      field: 'username',
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    storageLocation: {
      field: 'storage_location',
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    storageLocationTarget: {
      field: 'storage_location_target',
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    transactionType: {
      field: 'transaction_type',
      type: DataTypes.STRING(2),
      allowNull: true,
      comment: 'GI (Good Issue) or GR (Good Receive)',
    },
    isSummarized: {
      field: 'is_summarized',
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    tableName: 'scale_results',
    updatedAt: false,
    paranoid: false,
  }
);

ScaleResults.addHook('beforeCreate', async (scaleResult, options) => {
  // Ensure scaleId is always provided
  if (!scaleResult.scaleId) {
    throw new Error('scaleId is required for creating scale results');
  }

  // Generate scaleTransactionId ONLY if not provided (don't override existing one)
  // Check both null and empty string
  if (
    !scaleResult.scaleTransactionId ||
    (typeof scaleResult.scaleTransactionId === 'string' &&
      scaleResult.scaleTransactionId.trim() === '')
  ) {
    try {
      // Get current date and time
      const now = dayjs();
      const currentDate = now.format('YYYYMMDD');
      const currentTime = now.format('HHmmss');

      // Find the latest record for this scaleId and date
      const [lastRecord] = await sequelize.query(
        `SELECT scale_transaction_id FROM scale_results 
         WHERE scale_id = ? AND DATE(created_at) = CURRENT_DATE
         ORDER BY id DESC LIMIT 1`,
        {
          type: QueryTypes.SELECT,
          replacements: [scaleResult.scaleId],
        }
      );

      let nextIndex = 1;
      if (lastRecord && lastRecord.scale_transaction_id) {
        // Extract index from last scaleTransactionId (e.g., "SCALE_20251111_094918_527" -> 527)
        const match = lastRecord.scale_transaction_id.match(/_(\d{3})$/);
        if (match) {
          nextIndex = parseInt(match[1], 10) + 1;
        }
      }

      // Format as SCALE_YYYYMMDD_HHMMSS_XXX
      scaleResult.scaleTransactionId = `SCALE_${currentDate}_${currentTime}_${String(
        nextIndex
      ).padStart(3, '0')}`;
    } catch (error) {
      // If query fails, generate with current date, time and index 1
      console.error('Error generating scaleTransactionId:', error);
      const now = dayjs();
      const currentDate = now.format('YYYYMMDD');
      const currentTime = now.format('HHmmss');
      scaleResult.scaleTransactionId = `SCALE_${currentDate}_${currentTime}_001`;
    }
  }
});

module.exports = ScaleResults;
