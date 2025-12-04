'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ENUM type for status
    await queryInterface.sequelize.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weight_summary_batch_item_status_enum') THEN
          CREATE TYPE weight_summary_batch_item_status_enum AS ENUM ('pending', 'success', 'failed');
        END IF;
      END $$;
    `);

    // Add material_document column
    await queryInterface.addColumn(
      'weight_summary_batch_item',
      'material_document',
      {
        type: Sequelize.STRING(50),
        allowNull: true,
      }
    );

    // Add status column with ENUM type
    await queryInterface.addColumn(
      'weight_summary_batch_item',
      'status',
      {
        type: Sequelize.ENUM('pending', 'success', 'failed'),
        defaultValue: 'pending',
        allowNull: true,
      }
    );
  },

  async down(queryInterface, Sequelize) {
    // Remove status column
    await queryInterface.removeColumn(
      'weight_summary_batch_item',
      'status'
    );

    // Remove material_document column
    await queryInterface.removeColumn(
      'weight_summary_batch_item',
      'material_document'
    );

    // Drop ENUM type
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS weight_summary_batch_item_status_enum;
    `);
  },
};

