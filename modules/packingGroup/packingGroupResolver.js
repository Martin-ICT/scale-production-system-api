const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const PackingGroup = require('../../models/packingGroup');
const hasPermission = require('../../middlewares/hasPermission');

const validationSchemas = {
  packingGroupCreate: Joi.object({
    name: Joi.string().required(),
  }),
  packingGroupUpdate: Joi.object({
    id: Joi.number().integer().required(),
    name: Joi.string().required(),
  }),
  packingGroupDelete: Joi.object({
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
    packingGroupList: combineResolvers(
      // hasPermission('packingGroup.read'),
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

          const countResult = await PackingGroup.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await PackingGroup.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
          });

          return {
            packingGroups: result,
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

    packingGroupDetail: combineResolvers(
      // hasPermission('packingGroup.read'),
      async (_, { id }) => {
        try {
          const packingGroup = await PackingGroup.findByPk(id);

          if (!packingGroup) {
            throw new ApolloError(
              'Packing Group not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          return packingGroup;
        } catch (err) {
          throw err;
        }
      }
    ),
  },

  Mutation: {
    packingGroupCreate: combineResolvers(
      // hasPermission('packingGroup.create'),
      async (_, { input }) => {
        validateInput(validationSchemas.packingGroupCreate, input);

        const transaction = await PackingGroup.sequelize.transaction();

        try {
          const existingPackingGroup = await PackingGroup.findOne({
            where: {
              name: input.name,
            },
          });

          if (existingPackingGroup) {
            throw new ApolloError(
              'A packing group with the same name already exists',
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          const newPackingGroup = await PackingGroup.create(input, {
            transaction,
          });

          await transaction.commit();
          return newPackingGroup;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    packingGroupUpdate: combineResolvers(
      // hasPermission('packingGroup.update'),
      async (_, { id, input }) => {
        validateInput(validationSchemas.packingGroupUpdate, { id, ...input });

        const transaction = await PackingGroup.sequelize.transaction();

        try {
          const packingGroup = await PackingGroup.findByPk(id);
          if (!packingGroup) {
            throw new ApolloError(
              'Packing Group not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          if (input.name && input.name !== packingGroup.name) {
            const existingPackingGroup = await PackingGroup.findOne({
              where: {
                name: input.name,
                id: { [Sequelize.Op.ne]: id },
              },
            });

            if (existingPackingGroup) {
              throw new ApolloError(
                'A packing group with the same name already exists',
                apolloErrorCodes.BAD_DATA_VALIDATION
              );
            }
          }

          await packingGroup.update(input, { transaction });

          await transaction.commit();
          return packingGroup;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    packingGroupDelete: combineResolvers(
      // hasPermission('packingGroup.delete'),
      async (_, { id }) => {
        validateInput(validationSchemas.packingGroupDelete, { id });

        const transaction = await PackingGroup.sequelize.transaction();

        try {
          const packingGroup = await PackingGroup.findByPk(id);
          if (!packingGroup) {
            throw new ApolloError(
              'Packing Group not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          await packingGroup.destroy({ transaction, force: true });

          await transaction.commit();

          return packingGroup;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),
  },
};
