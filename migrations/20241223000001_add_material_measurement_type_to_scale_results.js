'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ENUM type for material_measurement_type
    await queryInterface.sequelize.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scale_results_material_measurement_type_enum') THEN
          CREATE TYPE scale_results_material_measurement_type_enum AS ENUM ('actual', 'standard');
        END IF;
      END $$;
    `);

    // Add material_measurement_type column
    await queryInterface.addColumn(
      'scale_results',
      'material_measurement_type',
      {
        type: Sequelize.ENUM('actual', 'standard'),
        allowNull: true,
      }
    );
  },

  async down(queryInterface, Sequelize) {
    // Remove material_measurement_type column
    await queryInterface.removeColumn(
      'scale_results',
      'material_measurement_type'
    );

    // Drop ENUM type
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS scale_results_material_measurement_type_enum;
    `);
  },
};

