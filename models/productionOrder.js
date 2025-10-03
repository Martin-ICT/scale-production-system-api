const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');

const ProductionOrder = sequelize.define(
  'production_order',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    productionOrderNumber: {
      field: 'production_order_number',
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'production_order_SAP',
        key: 'production_order_number',
      },
    },
    plantId: {
      field: 'plant_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'plant',
        key: 'id',
      },
    },
    orderType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    materialId: {
      field: 'material_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'material',
        key: 'id',
      },
    },
    productionDate: {
      field: 'production_date',
      type: DataTypes.DATE,
      allowNull: false,
      get() {
        const rawValue = this.getDataValue('productionDate');
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
    tableName: 'production_order',
    paranoid: true,
  }
);

ProductionOrder.associate = (models) => {
  ProductionOrder.hasMany(models.ProductionOrderLine, {
    foreignKey: 'productionOrderId',
    as: 'productionOrder',
  });

  ProductionOrder.belongsTo(models.Plant, {
    foreignKey: 'plantId',
    as: 'plant',
  });

  ProductionOrder.belongsTo(models.Material, {
    foreignKey: 'materialId',
    as: 'material',
  });
};

module.exports = ProductionOrder;
