const { DataTypes } = require('sequelize');
const sequelizeWms = require('../dbWms');
const bcrypt = require('bcrypt');

/**
 * User Model - mapped to WMS database 'ad_user' table
 *
 * Note: Model ini hanya mendefinisikan kolom yang digunakan untuk authentication.
 * Kolom lain yang ada di database ad_user akan diabaikan oleh Sequelize.
 * Tambahkan kolom sesuai kebutuhan Anda.
 */
const User = sequelizeWms.define(
  'ad_user',
  {
    userId: {
      field: 'ad_user_id',
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    clientId: {
      field: 'ad_client_id',
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    organizationId: {
      field: 'ad_org_id',
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isActive: {
      field: 'isactive',
      type: DataTypes.CHAR(1),
      allowNull: false,
      defaultValue: 'Y',
    },
  },
  {
    freezeTableName: true,
    tableName: 'ad_user',
    timestamps: false, // Disable automatic timestamp fields
  }
);

// Method to compare password
// Supports both plain text and bcrypt hashed passwords
User.prototype.comparePassword = async function (candidatePassword) {
  // Check if password is bcrypt hashed
  const isBcryptHash =
    this.password.startsWith('$2b$') || this.password.startsWith('$2a$');

  if (isBcryptHash) {
    // Compare with bcrypt
    return await bcrypt.compare(candidatePassword, this.password);
  } else {
    // Plain text comparison
    return this.password === candidatePassword;
  }
};

module.exports = User;
