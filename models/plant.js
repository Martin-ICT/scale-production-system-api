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
    companyId: {
      field: 'company_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'company',
        key: 'id',
      },
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
        fields: ['code', 'company_id'],
      },
    ],
  }
);

Plant.associate = (models) => {
  Plant.belongsTo(models.Company, { foreignKey: 'companyId', as: 'company' });

  Plant.hasMany(models.Scale, { foreignKey: 'plantId', as: 'scale' });

  Plant.hasMany(models.ProductionOrder, {
    foreignKey: 'plantId',
    as: 'productionOrder',
  });
};

module.exports = Plant;
