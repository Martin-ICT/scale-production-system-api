const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');

const Plant = sequelize.define(
  'plant',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    address: {
      type: DataTypes.STRING,
      allowNull: false,
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
    tableName: 'plant',
    paranoid: true,
    indexes: [
      {
        unique: true,
        fields: ['code'],
      },
    ],
  }
);

Plant.associate = (models) => {
  Plant.hasMany(models.Scale, { foreignKey: 'plantId', as: 'scale' });
};

module.exports = Plant;
