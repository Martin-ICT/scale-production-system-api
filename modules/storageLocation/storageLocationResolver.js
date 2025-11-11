const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const StorageLocation = require('../../models/storageLocation');
const hasPermission = require('../../middlewares/hasPermission');
const isAuthenticated = require('../../middlewares/isAuthenticated');

const validationSchemas = {
  storageLocationCreate: Joi.object({
    code: Joi.string().required(),
    name: Joi.string().optional().allow(null, ''),
  }),
  storageLocationUpdate: Joi.object({
    id: Joi.number().integer().required(),
    code: Joi.string().optional(),
    name: Joi.string().optional().allow(null, ''),
  }),
  storageLocationDelete: Joi.object({
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
    storageLocationList: combineResolvers(
      isAuthenticated,
      // hasPermission('storageLocation.read'),
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

          const countResult = await StorageLocation.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await StorageLocation.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
          });

          return {
            storageLocations: result,
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

    storageLocationDetail: combineResolvers(
      isAuthenticated,
      // hasPermission('storageLocation.read'),
      async (_, { id }) => {
        try {
          const storageLocation = await StorageLocation.findByPk(id);

          if (!storageLocation) {
            throw new ApolloError(
              'Storage Location not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          return storageLocation;
        } catch (err) {
          throw err;
        }
      }
    ),
  },

  Mutation: {
    storageLocationCreate: combineResolvers(
      isAuthenticated,
      // hasPermission('storageLocation.create'),
      async (_, { input }) => {
        validateInput(validationSchemas.storageLocationCreate, input);

        const transaction = await StorageLocation.sequelize.transaction();

        try {
          // Check for duplicate code (code is unique)
          const existingStorageLocation = await StorageLocation.findOne({
            where: {
              code: input.code,
            },
          });

          if (existingStorageLocation) {
            throw new ApolloError(
              'A storage location with the same code already exists',
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          const newStorageLocation = await StorageLocation.create(input, {
            transaction,
          });

          await transaction.commit();
          return newStorageLocation;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    storageLocationUpdate: combineResolvers(
      isAuthenticated,
      // hasPermission('storageLocation.update'),
      async (_, { id, input }) => {
        validateInput(validationSchemas.storageLocationUpdate, {
          id,
          ...input,
        });

        const transaction = await StorageLocation.sequelize.transaction();

        try {
          const storageLocation = await StorageLocation.findByPk(id);
          if (!storageLocation) {
            throw new ApolloError(
              'Storage Location not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Check for duplicate code if code is being updated
          if (input.code && input.code !== storageLocation.code) {
            const existingStorageLocation = await StorageLocation.findOne({
              where: {
                code: input.code,
                id: { [Sequelize.Op.ne]: id },
              },
            });

            if (existingStorageLocation) {
              throw new ApolloError(
                'A storage location with the same code already exists',
                apolloErrorCodes.BAD_DATA_VALIDATION
              );
            }
          }

          await storageLocation.update(input, { transaction });

          await transaction.commit();
          return storageLocation;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    storageLocationDelete: combineResolvers(
      isAuthenticated,
      // hasPermission('storageLocation.delete'),
      async (_, { id }) => {
        validateInput(validationSchemas.storageLocationDelete, { id });

        const transaction = await StorageLocation.sequelize.transaction();

        try {
          const storageLocation = await StorageLocation.findByPk(id);
          if (!storageLocation) {
            throw new ApolloError(
              'Storage Location not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          await storageLocation.destroy({ transaction, force: true });

          await transaction.commit();

          return storageLocation;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),
  },
};
