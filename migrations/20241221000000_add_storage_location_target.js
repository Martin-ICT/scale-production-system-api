'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add storage_location_target column to scale_results table
    await queryInterface.addColumn('scale_results', 'storage_location_target', {
      type: Sequelize.STRING(10),
      allowNull: true,
    });

    // Add storage_location_target column to weight_summary_batch_item table
    await queryInterface.addColumn(
      'weight_summary_batch_item',
      'storage_location_target',
      {
        type: Sequelize.STRING(4),
        allowNull: true,
      }
    );
  },

  async down(queryInterface, Sequelize) {
    // Remove storage_location_target column from weight_summary_batch_item table
    await queryInterface.removeColumn(
      'weight_summary_batch_item',
      'storage_location_target'
    );

    // Remove storage_location_target column from scale_results table
    await queryInterface.removeColumn(
      'scale_results',
      'storage_location_target'
    );
  },
};

