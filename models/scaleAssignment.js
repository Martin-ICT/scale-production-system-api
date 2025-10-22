const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');

const ScaleAssignment = sequelize.define(
  'scale_assignment',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    scaleId: {
      field: 'scale_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'scale',
        key: 'id',
      },
    },
    goodReceiveId: {
      field: 'good_receive_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'good_receive',
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
    tableName: 'scale_assignment',
    paranoid: true,
  }
);

ScaleAssignment.associate = (models) => {
  ScaleAssignment.belongsTo(models.Scale, {
    foreignKey: 'scaleId',
    as: 'scale',
  });
  ScaleAssignment.belongsTo(models.GoodReceive, {
    foreignKey: 'goodReceiveId',
    as: 'goodReceive',
  });
};

module.exports = ScaleAssignment;
