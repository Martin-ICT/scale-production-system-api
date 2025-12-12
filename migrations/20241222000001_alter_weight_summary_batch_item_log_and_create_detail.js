'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Drop old columns from weight_summary_batch_item_log
    await queryInterface.removeColumn(
      'weight_summary_batch_item_log',
      'total_weight'
    );
    await queryInterface.removeColumn(
      'weight_summary_batch_item_log',
      'total_weight_converted'
    );
    await queryInterface.removeColumn(
      'weight_summary_batch_item_log',
      'updated_by'
    );
    await queryInterface.removeColumn(
      'weight_summary_batch_item_log',
      'updated_at'
    );
    await queryInterface.removeColumn(
      'weight_summary_batch_item_log',
      'deleted_at'
    );

    // Step 2: Drop old indexes related to deleted_at
    await queryInterface.removeIndex(
      'weight_summary_batch_item_log',
      'idx_weight_summary_batch_item_log_deleted_at'
    );

    // Step 3: Create ENUM type for operation
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_weight_summary_batch_item_log_operation" AS ENUM ('split', 'merge', 'edit', 'createFromFailed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Step 4: Add operation column
    await queryInterface.addColumn(
      'weight_summary_batch_item_log',
      'operation',
      {
        type: Sequelize.ENUM('split', 'merge', 'edit', 'createFromFailed'),
        allowNull: false,
        defaultValue: 'edit', // Default value for existing records
        comment: 'Jenis operasi: split, merge, edit, atau createFromFailed',
      }
    );

    // Step 5: Create weight_summary_batch_item_log_detail table
    await queryInterface.createTable('weight_summary_batch_item_log_detail', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      weight_summary_batch_item_log_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'weight_summary_batch_item_log',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Foreign key ke weight_summary_batch_item_log',
      },
      weight_summary_batch_item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'weight_summary_batch_item',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Foreign key ke weight_summary_batch_item',
      },
      before_data: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Data sebelum perubahan dalam format JSON',
      },
      after_data: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Data setelah perubahan dalam format JSON',
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
    });

    // Step 6: Add indexes for better query performance
    await queryInterface.addIndex(
      'weight_summary_batch_item_log_detail',
      ['weight_summary_batch_item_log_id'],
      {
        name: 'idx_weight_summary_batch_item_log_detail_log_id',
      }
    );
    await queryInterface.addIndex(
      'weight_summary_batch_item_log_detail',
      ['weight_summary_batch_item_id'],
      {
        name: 'idx_weight_summary_batch_item_log_detail_item_id',
      }
    );
  },

  async down(queryInterface, Sequelize) {
    // Drop detail table first
    await queryInterface.dropTable('weight_summary_batch_item_log_detail');

    // Remove operation column
    await queryInterface.removeColumn(
      'weight_summary_batch_item_log',
      'operation'
    );

    // Drop ENUM type
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_weight_summary_batch_item_log_operation";
    `);

    // Add back old columns
    await queryInterface.addColumn(
      'weight_summary_batch_item_log',
      'total_weight',
      {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
        defaultValue: 0,
        comment: 'Total weight yang dipindahkan',
      }
    );
    await queryInterface.addColumn(
      'weight_summary_batch_item_log',
      'total_weight_converted',
      {
        type: Sequelize.DECIMAL(10, 3),
        allowNull: true,
        defaultValue: 0,
        comment: 'Total weight converted yang dipindahkan',
      }
    );
    await queryInterface.addColumn(
      'weight_summary_batch_item_log',
      'updated_by',
      {
        type: Sequelize.INTEGER,
        allowNull: true,
      }
    );
    await queryInterface.addColumn(
      'weight_summary_batch_item_log',
      'updated_at',
      {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      }
    );
    await queryInterface.addColumn(
      'weight_summary_batch_item_log',
      'deleted_at',
      {
        type: Sequelize.DATE,
        allowNull: true,
      }
    );

    // Add back deleted_at index
    await queryInterface.addIndex(
      'weight_summary_batch_item_log',
      ['deleted_at'],
      {
        name: 'idx_weight_summary_batch_item_log_deleted_at',
      }
    );
  },
};
