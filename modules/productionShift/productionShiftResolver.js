const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const ProductionShift = require('../../models/productionShift');
const hasPermission = require('../../middlewares/hasPermission');

const validationSchemas = {
  productionShiftCreate: Joi.object({
    name: Joi.string().required(),
  }),
  productionShiftUpdate: Joi.object({
    id: Joi.number().integer().required(),
    name: Joi.string().required(),
  }),
  productionShiftDelete: Joi.object({
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
    productionShiftList: combineResolvers(
      // hasPermission('productionShift.read'),
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

          const countResult = await ProductionShift.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await ProductionShift.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
          });

          return {
            productionShifts: result,
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

    productionShiftDetail: combineResolvers(
      // hasPermission('productionShift.read'),
      async (_, { id }) => {
        try {
          const productionShift = await ProductionShift.findByPk(id);

          if (!productionShift) {
            throw new ApolloError(
              'Production Shift not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          return productionShift;
        } catch (err) {
          throw err;
        }
      }
    ),
  },

  Mutation: {
    productionShiftCreate: combineResolvers(
      // hasPermission('productionShift.create'),
      async (_, { input }) => {
        validateInput(validationSchemas.productionShiftCreate, input);

        const transaction = await ProductionShift.sequelize.transaction();

        try {
          const existingProductionShift = await ProductionShift.findOne({
            where: {
              name: input.name,
            },
          });

          if (existingProductionShift) {
            throw new ApolloError(
              'A production shift with the same name already exists',
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          const newProductionShift = await ProductionShift.create(input, {
            transaction,
          });

          await transaction.commit();
          return newProductionShift;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    productionShiftUpdate: combineResolvers(
      // hasPermission('productionShift.update'),
      async (_, { id, input }) => {
        validateInput(validationSchemas.productionShiftUpdate, {
          id,
          ...input,
        });

        const transaction = await ProductionShift.sequelize.transaction();

        try {
          const productionShift = await ProductionShift.findByPk(id);
          if (!productionShift) {
            throw new ApolloError(
              'Production Shift not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          if (input.name && input.name !== productionShift.name) {
            const existingProductionShift = await ProductionShift.findOne({
              where: {
                name: input.name,
                id: { [Sequelize.Op.ne]: id },
              },
            });

            if (existingProductionShift) {
              throw new ApolloError(
                'A production shift with the same name already exists',
                apolloErrorCodes.BAD_DATA_VALIDATION
              );
            }
          }

          await productionShift.update(input, { transaction });

          await transaction.commit();
          return productionShift;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    productionShiftDelete: combineResolvers(
      // hasPermission('productionShift.delete'),
      async (_, { id }) => {
        validateInput(validationSchemas.productionShiftDelete, { id });

        const transaction = await ProductionShift.sequelize.transaction();

        try {
          const productionShift = await ProductionShift.findByPk(id);
          if (!productionShift) {
            throw new ApolloError(
              'Production Shift not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          await productionShift.destroy({ transaction, force: true });

          await transaction.commit();

          return productionShift;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),
  },
};

