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

const validationSchemas = {
  storageLocationCreate: Joi.object({
    name: Joi.string().required(),
  }),
  storageLocationUpdate: Joi.object({
    id: Joi.number().integer().required(),
    name: Joi.string().required(),
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
              inColumns: ['name'],
            });
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
      // hasPermission('storageLocation.create'),
      async (_, { input }) => {
        validateInput(validationSchemas.storageLocationCreate, input);

        const transaction = await StorageLocation.sequelize.transaction();

        try {
          const existingStorageLocation = await StorageLocation.findOne({
            where: {
              name: input.name,
            },
          });

          if (existingStorageLocation) {
            throw new ApolloError(
              'A storage location with the same name already exists',
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

          if (input.name && input.name !== storageLocation.name) {
            const existingStorageLocation = await StorageLocation.findOne({
              where: {
                name: input.name,
                id: { [Sequelize.Op.ne]: id },
              },
            });

            if (existingStorageLocation) {
              throw new ApolloError(
                'A storage location with the same name already exists',
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

