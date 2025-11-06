'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('scale', 'capacity', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    // PostgreSQL requires raw SQL to convert VARCHAR back to ENUM
    // because Sequelize doesn't support ENUM type directly in PostgreSQL
    await queryInterface.sequelize.query(`
      DO $$ 
      BEGIN
        -- Create the ENUM type if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scale_capacity_enum') THEN
          CREATE TYPE scale_capacity_enum AS ENUM ('3', '6', '9', '12', '15');
        END IF;
      END $$;

      -- Alter column back to ENUM
      ALTER TABLE scale 
      ALTER COLUMN capacity TYPE scale_capacity_enum 
      USING capacity::scale_capacity_enum;
    `);
  },
};
