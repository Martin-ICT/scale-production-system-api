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
    plant: {
      field: 'plant',
      type: DataTypes.STRING(4),
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
    weight_converted: {
      field: 'weight_converted',
      type: DataTypes.DECIMAL(10, 2),
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
      type: DataTypes.STRING(4),
      allowNull: true,
    },
    transactionType: {
      field: 'transaction_type',
      type: DataTypes.STRING(2),
      allowNull: true,
      comment: 'GI (Good Issue) or GR (Good Receive)',
    },
    isProcessed: {
      field: 'is_processed',
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'True jika data sudah diproses ke weight_summary',
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

  // Generate scaleTransactionId if not provided
  if (!scaleResult.scaleTransactionId) {
    try {
      // Get current date in YYYYMMDD format
      const currentDate = dayjs().format('YYYYMMDD');

      // Ensure scaleId is 3 digits with zero padding
      const scaleId = String(scaleResult.scaleId).padStart(3, '0');

      // Find the latest record for this scaleId and date
      const [lastRecord] = await sequelize.query(
        `SELECT scale_transaction_id FROM scale_results 
         WHERE scale_id = ? AND DATE(created_at) = CURRENT_DATE
         ORDER BY id DESC LIMIT 1`,
        {
          type: QueryTypes.SELECT,
          replacements: [scaleId],
        }
      );

      let nextIndex = 1;
      if (lastRecord && lastRecord.scale_transaction_id) {
        // Extract index from last scaleTransactionId (e.g., "SC0001011020251" -> 1)
        const match = lastRecord.scale_transaction_id.match(/(\d{3})$/);
        if (match) {
          nextIndex = parseInt(match[1], 10) + 1;
        }
      }

      // Format as SC0001011020251 (SC + scaleId + date + index, no separators)
      scaleResult.scaleTransactionId = `${scaleId}${currentDate}${String(
        nextIndex
      ).padStart(3, '0')}`;
    } catch (error) {
      // If query fails, generate with current date and index 1
      console.error('Error generating scaleTransactionId:', error);
      const currentDate = dayjs().format('YYYYMMDD');
      const scaleId = String(scaleResult.scaleId).padStart(3, '0');
      scaleResult.scaleTransactionId = `${scaleId}${currentDate}001`;
    }
  }
});

module.exports = ScaleResults;
