const { Sequelize } = require('sequelize');

// WMS Database configuration (External PostgreSQL)
const config = {
  dialect: 'postgres',
  host: process.env.WMS_DB_HOST || '10.1.3.139',
  port: process.env.WMS_DB_PORT || 5437,
  database: process.env.WMS_DB_NAME || 'wmsdbdev',
  username: process.env.WMS_DB_USER || 'adempiere',
  password: process.env.WMS_DB_PASSWORD || 'WMSDb!23?',
  logging: false, // Set to console.log to see SQL queries
};

console.log('🔍 WMS Database Config:', {
  ...config,
  password: config.password ? '***' : '(empty)',
});

const sequelizeWms = new Sequelize({
  ...config,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

// Test database connection
sequelizeWms
  .authenticate()
  .then(() => {
    console.log('✅ WMS Database connection established successfully.');
  })
  .catch((err) => {
    console.error('❌ Unable to connect to WMS database:', err.message);
  });

module.exports = sequelizeWms;




