const { DataTypes } = require('sequelize');
const Sequelize = require('sequelize');
const sequelize = require('../db');

// Helper function to generate device ID
const generateDeviceId = async (model) => {
  // Find the highest device ID
  const lastScale = await model.findOne({
    where: {
      deviceId: {
        [Sequelize.Op.like]: 'SC%',
      },
    },
    order: [['deviceId', 'DESC']],
  });

  let nextNumber = 1;
  if (lastScale) {
    const lastDeviceId = lastScale.deviceId;
    // Extract number from deviceId (e.g., "SC000001" -> 1)
    const match = lastDeviceId.match(/SC(\d{6})/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `SC${String(nextNumber).padStart(6, '0')}`;
};

const Scale = sequelize.define(
  'scale',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    deviceIP: {
      field: 'device_ip',
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    deviceId: {
      field: 'device_id',
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    brand: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    plantCode: {
      field: 'plant_code',
      type: DataTypes.STRING,
      allowNull: true,
    },
    uom: {
      type: DataTypes.ENUM('kg', 'g'),
      allowNull: false,
    },
    capacity: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Scale capacity in kilograms',
    },
    lastCalibrate: {
      field: 'last_calibrate',
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      allowNull: false,
      defaultValue: 'active',
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
    tableName: 'scale',
    paranoid: true,
  }
);

// Hook to auto-generate device ID before creating
Scale.beforeCreate(async (instance) => {
  if (!instance.deviceId) {
    instance.deviceId = await generateDeviceId(Scale);
  }
});

Scale.associate = (models) => {
  Scale.hasMany(models.ScaleAssignment, {
    foreignKey: 'scaleId',
    as: 'scaleAssignments',
  });
};

module.exports = Scale;
