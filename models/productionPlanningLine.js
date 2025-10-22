const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');

const ProductionPlanningLine = sequelize.define(
  'production_planning_line',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    productionPlanningId: {
      field: 'production_planning_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'production_planning',
        key: 'id',
      },
    },
    materialCode: {
      field: 'material_code',
      type: DataTypes.STRING,
      allowNull: false,
    },
    targetWeight: {
      field: 'target_weight',
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    orderTypeId: {
      field: 'order_type_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'order_type',
        key: 'id',
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
    tableName: 'production_planning_line',
    paranoid: true,
  }
);

ProductionPlanningLine.associate = (models) => {
  ProductionPlanningLine.belongsTo(models.OrderType, {
    foreignKey: 'orderTypeId',
    as: 'orderType',
  });
};

module.exports = ProductionPlanningLine;
