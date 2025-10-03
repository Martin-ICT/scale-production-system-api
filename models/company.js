const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');

const Company = sequelize.define(
  'company',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM('Active', 'Inactive'),
      defaultValue: 'Active',
      allowNull: true,
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
    tableName: 'company',
    paranoid: true,
    indexes: [
      {
        unique: true,
        fields: ['name', 'code'],
      },
    ],
  }
);

Company.associate = (models) => {
  Company.hasMany(models.Plant, { foreignKey: 'companyId', as: 'plants' });
};

module.exports = Company;

