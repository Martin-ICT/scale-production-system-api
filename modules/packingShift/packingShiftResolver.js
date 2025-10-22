const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const PackingShift = require('../../models/packingShift');
const hasPermission = require('../../middlewares/hasPermission');

const validationSchemas = {
  packingShiftCreate: Joi.object({
    name: Joi.string().required(),
  }),
  packingShiftUpdate: Joi.object({
    id: Joi.number().integer().required(),
    name: Joi.string().required(),
  }),
  packingShiftDelete: Joi.object({
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
    packingShiftList: combineResolvers(
      // hasPermission('packingShift.read'),
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

          const countResult = await PackingShift.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await PackingShift.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
          });

          return {
            packingShifts: result,
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

    packingShiftDetail: combineResolvers(
      // hasPermission('packingShift.read'),
      async (_, { id }) => {
        try {
          const packingShift = await PackingShift.findByPk(id);

          if (!packingShift) {
            throw new ApolloError(
              'Packing Shift not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          return packingShift;
        } catch (err) {
          throw err;
        }
      }
    ),
  },

  Mutation: {
    packingShiftCreate: combineResolvers(
      // hasPermission('packingShift.create'),
      async (_, { input }) => {
        validateInput(validationSchemas.packingShiftCreate, input);

        const transaction = await PackingShift.sequelize.transaction();

        try {
          const existingPackingShift = await PackingShift.findOne({
            where: {
              name: input.name,
            },
          });

          if (existingPackingShift) {
            throw new ApolloError(
              'A packing shift with the same name already exists',
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          const newPackingShift = await PackingShift.create(input, {
            transaction,
          });

          await transaction.commit();
          return newPackingShift;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    packingShiftUpdate: combineResolvers(
      // hasPermission('packingShift.update'),
      async (_, { id, input }) => {
        validateInput(validationSchemas.packingShiftUpdate, { id, ...input });

        const transaction = await PackingShift.sequelize.transaction();

        try {
          const packingShift = await PackingShift.findByPk(id);
          if (!packingShift) {
            throw new ApolloError(
              'Packing Shift not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          if (input.name && input.name !== packingShift.name) {
            const existingPackingShift = await PackingShift.findOne({
              where: {
                name: input.name,
                id: { [Sequelize.Op.ne]: id },
              },
            });

            if (existingPackingShift) {
              throw new ApolloError(
                'A packing shift with the same name already exists',
                apolloErrorCodes.BAD_DATA_VALIDATION
              );
            }
          }

          await packingShift.update(input, { transaction });

          await transaction.commit();
          return packingShift;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    packingShiftDelete: combineResolvers(
      // hasPermission('packingShift.delete'),
      async (_, { id }) => {
        validateInput(validationSchemas.packingShiftDelete, { id });

        const transaction = await PackingShift.sequelize.transaction();

        try {
          const packingShift = await PackingShift.findByPk(id);
          if (!packingShift) {
            throw new ApolloError(
              'Packing Shift not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          await packingShift.destroy({ transaction, force: true });

          await transaction.commit();

          return packingShift;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),
  },
};

