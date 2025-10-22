const { Sequelize } = require('sequelize');

// Database configuration
const config = {
  dialect: 'postgres', // or 'postgres', 'sqlite', 'mariadb', 'mssql'
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'scale_monitor_system',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  logging: console.log, // Enable logging to see SQL queries
};

console.log('🔍 Database Config:', config);

const sequelize = new Sequelize({
  ...config,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

// Test database connection
sequelize
  .authenticate()
  .then(() => {
    console.log('Database connection has been established successfully.');
  })
  .catch((err) => {
    console.error('Unable to connect to the database:', err);
  });

module.exports = sequelize;
