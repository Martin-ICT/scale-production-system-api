const { Sequelize } = require('sequelize');

// WMS Database configuration (External PostgreSQL)
const config = {
  dialect: 'postgres',
  host: process.env.WMS_DB_HOST,
  port: process.env.WMS_DB_PORT,
  database: process.env.WMS_DB_NAME,
  username: process.env.WMS_DB_USER,
  password: process.env.WMS_DB_PASSWORD,
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
