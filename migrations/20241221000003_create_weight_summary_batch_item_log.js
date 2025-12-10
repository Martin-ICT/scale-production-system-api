'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('weight_summary_batch_item_log', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_from: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'weight_summary_batch_item',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'ID dari weight_summary_batch_item yang menjadi sumber',
      },
      id_to: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'weight_summary_batch_item',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'ID ke weight_summary_batch_item yang menjadi tujuan',
      },
      total_weight: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
        defaultValue: 0,
        comment: 'Total weight yang dipindahkan',
      },
      total_weight_converted: {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
        defaultValue: 0,
        comment: 'Total weight converted yang dipindahkan',
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('weight_summary_batch_item_log', ['id_from'], {
      name: 'idx_weight_summary_batch_item_log_id_from',
    });
    await queryInterface.addIndex('weight_summary_batch_item_log', ['id_to'], {
      name: 'idx_weight_summary_batch_item_log_id_to',
    });
    await queryInterface.addIndex('weight_summary_batch_item_log', ['deleted_at'], {
      name: 'idx_weight_summary_batch_item_log_deleted_at',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('weight_summary_batch_item_log');
  },
};




