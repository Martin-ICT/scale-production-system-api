const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');

const GoodReceive = sequelize.define(
  'good_receive',
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
    rawMaterialCode: {
      field: 'raw_material_code',
      type: DataTypes.STRING,
      allowNull: false,
    },
    processingType: {
      field: 'processing_type',
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    totalWeight: {
      field: 'total_weight',
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    recipient: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    storageLocationId: {
      field: 'storage_location_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'storage_location',
        key: 'id',
      },
    },
    productionGroupId: {
      field: 'production_group_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'production_group',
        key: 'id',
      },
    },
    productionLotId: {
      field: 'production_lot_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'production_lot',
        key: 'id',
      },
    },
    productionShiftId: {
      field: 'production_shift_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'production_shift',
        key: 'id',
      },
    },
    packingGroupId: {
      field: 'packing_group_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'packing_group',
        key: 'id',
      },
    },
    packingShiftId: {
      field: 'packing_shift_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'packing_shift',
        key: 'id',
      },
    },
    packingDate: {
      field: 'packing_date',
      type: DataTypes.DATE,
      allowNull: false,
      get() {
        const rawValue = this.getDataValue('pack_date');
        return rawValue ? dayjs(rawValue).format('YYYY-MM-DD HH:mm:ss') : null;
      },
    },
    createdAt: {
      field: 'created_at',
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
      allowNull: false,
      get() {
        const rawValue = this.getDataValue('createdAt');
        return rawValue ? dayjs(rawValue).format('YYYY-MM-DD HH:mm:ss') : null;
      },
    },
    updatedAt: {
      field: 'updated_at',
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW,
      allowNull: false,
      get() {
        const rawValue = this.getDataValue('updatedAt');
        return rawValue ? dayjs(rawValue).format('YYYY-MM-DD HH:mm:ss') : null;
      },
    },
    deletedAt: {
      field: 'deleted_at',
      type: DataTypes.DATE,
    },
  },
  {
    freezeTableName: true,
    tableName: 'good_receive',
    paranoid: true,
  }
);

GoodReceive.associate = (models) => {
  GoodReceive.belongsTo(models.ProductionOrderSAP, {
    foreignKey: 'productionOrderId',
    as: 'productionOrder',
  });

  GoodReceive.belongsTo(models.ProductionGroup, {
    foreignKey: 'productionGroupId',
    as: 'productionGroup',
  });

  GoodReceive.belongsTo(models.ProductionShift, {
    foreignKey: 'productionShiftId',
    as: 'productionShift',
  });

  GoodReceive.belongsTo(models.ProductionLot, {
    foreignKey: 'productionLotId',
    as: 'productionLot',
  });

  GoodReceive.belongsTo(models.PackingGroup, {
    foreignKey: 'packingGroupId',
    as: 'packingGroup',
  });

  GoodReceive.belongsTo(models.PackingShift, {
    foreignKey: 'packingShiftId',
    as: 'packingShift',
  });
};

module.exports = GoodReceive;
