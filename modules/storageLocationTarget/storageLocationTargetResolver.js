const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const StorageLocationTarget = require('../../models/storageLocationTarget');
const hasPermission = require('../../middlewares/hasPermission');
const isAuthenticated = require('../../middlewares/isAuthenticated');

const validationSchemas = {
  storageLocationTargetCreate: Joi.object({
    code: Joi.string().required(),
    name: Joi.string().optional().allow(null, ''),
  }),
  storageLocationTargetUpdate: Joi.object({
    id: Joi.number().integer().required(),
    code: Joi.string().optional(),
    name: Joi.string().optional().allow(null, ''),
  }),
  storageLocationTargetDelete: Joi.object({
    id: Joi.number().integer().required(),
  }),
};

const validateInput = (schema, data) => {
  const { error } = schema.validate(data, {
    convert: true,
    abortEarly: false,
    allowUnknown: true,
  });
  if (error) joiErrorCallback(error);
};

module.exports = {
  Query: {
    storageLocationTargetList: combineResolvers(
      isAuthenticated,
      // hasPermission('storageLocationTarget.read'),
      pageMinCheckAndPageSizeMax,
      async (
        _,
        {
          page = 0,
          pageSize = 10,
          search = null,
          sort = { columnName: 'id', sortOrder: 'ASC' },
          filter,
        }
      ) => {
        try {
          let whereClause = {};

          if (search) {
            whereClause = definedSearch({
              query: search,
              inColumns: ['code', 'name'],
            });
          }

          if (filter?.code) {
            whereClause.code = {
              [Sequelize.Op.like]: `%${filter.code}%`,
            };
          }

          if (filter?.name) {
            whereClause.name = {
              [Sequelize.Op.like]: `%${filter.name}%`,
            };
          }

          const countResult = await StorageLocationTarget.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await StorageLocationTarget.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
          });

          return {
            storageLocationTargets: result,
            meta: {
              totalItems: countResult,
              pageSize,
              currentPage: page,
              totalPages: Math.ceil(countResult / pageSize),
            },
          };
        } catch (err) {
          throw err;
        }
      }
    ),

    storageLocationTargetDetail: combineResolvers(
      isAuthenticated,
      // hasPermission('storageLocationTarget.read'),
      async (_, { id }) => {
        try {
          const storageLocationTarget = await StorageLocationTarget.findByPk(id);

          if (!storageLocationTarget) {
            throw new ApolloError(
              'Storage Location Target not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          return storageLocationTarget;
        } catch (err) {
          throw err;
        }
      }
    ),
  },

  Mutation: {
    storageLocationTargetCreate: combineResolvers(
      isAuthenticated,
      // hasPermission('storageLocationTarget.create'),
      async (_, { input }) => {
        validateInput(validationSchemas.storageLocationTargetCreate, input);

        const transaction = await StorageLocationTarget.sequelize.transaction();

        try {
          // Check for duplicate code (code is unique)
          const existingStorageLocationTarget =
            await StorageLocationTarget.findOne({
              where: {
                code: input.code,
              },
            });

          if (existingStorageLocationTarget) {
            throw new ApolloError(
              'A storage location target with the same code already exists',
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          const newStorageLocationTarget = await StorageLocationTarget.create(
            input,
            {
              transaction,
            }
          );

          await transaction.commit();
          return newStorageLocationTarget;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    storageLocationTargetUpdate: combineResolvers(
      isAuthenticated,
      // hasPermission('storageLocationTarget.update'),
      async (_, { id, input }) => {
        validateInput(validationSchemas.storageLocationTargetUpdate, {
          id,
          ...input,
        });

        const transaction = await StorageLocationTarget.sequelize.transaction();

        try {
          const storageLocationTarget =
            await StorageLocationTarget.findByPk(id);
          if (!storageLocationTarget) {
            throw new ApolloError(
              'Storage Location Target not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Check for duplicate code if code is being updated
          if (input.code && input.code !== storageLocationTarget.code) {
            const existingStorageLocationTarget =
              await StorageLocationTarget.findOne({
                where: {
                  code: input.code,
                  id: { [Sequelize.Op.ne]: id },
                },
              });

            if (existingStorageLocationTarget) {
              throw new ApolloError(
                'A storage location target with the same code already exists',
                apolloErrorCodes.BAD_DATA_VALIDATION
              );
            }
          }

          await storageLocationTarget.update(input, { transaction });

          await transaction.commit();
          return storageLocationTarget;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    storageLocationTargetDelete: combineResolvers(
      isAuthenticated,
      // hasPermission('storageLocationTarget.delete'),
      async (_, { id }) => {
        validateInput(validationSchemas.storageLocationTargetDelete, { id });

        const transaction = await StorageLocationTarget.sequelize.transaction();

        try {
          const storageLocationTarget =
            await StorageLocationTarget.findByPk(id);
          if (!storageLocationTarget) {
            throw new ApolloError(
              'Storage Location Target not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          await storageLocationTarget.destroy({ transaction, force: true });

          await transaction.commit();

          return storageLocationTarget;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),
  },
};

