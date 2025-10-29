const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const OrderType = require('../../models/orderType');
const hasPermission = require('../../middlewares/hasPermission');
const isAuthenticated = require('../../middlewares/isAuthenticated');

const validationSchemas = {
  orderTypeCreate: Joi.object({
    code: Joi.string().required().max(2),
    name: Joi.string().required().max(20),
    processType: Joi.number().integer().required(),
    maxDay: Joi.number().integer().required(),
  }),
  orderTypeUpdate: Joi.object({
    id: Joi.number().integer().required(),
    code: Joi.string().max(2),
    name: Joi.string().max(20),
    processType: Joi.number().integer(),
    maxDay: Joi.number().integer(),
  }),
  orderTypeDelete: Joi.object({
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
    orderTypeList: combineResolvers(

      isAuthenticated,
      // hasPermission('orderType.read'),
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

          if (filter?.processType !== undefined) {
            whereClause.processType = filter.processType;
          }

          if (filter?.maxDay !== undefined) {
            whereClause.maxDay = filter.maxDay;
          }

          const countResult = await OrderType.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await OrderType.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
          });

          return {
            orderTypes: result,
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

    orderTypeDetail: combineResolvers(


      isAuthenticated,
      // hasPermission('orderType.read'),
      async (_, { id }) => {
        try {
          const orderType = await OrderType.findByPk(id);

          if (!orderType) {
            throw new ApolloError(
              'Order Type not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          return orderType;
        } catch (err) {
          throw err;
        }
      }
    ),
  },

  Mutation: {
    orderTypeCreate: combineResolvers(

      isAuthenticated,
      // hasPermission('orderType.create'),
      async (_, { input }) => {
        validateInput(validationSchemas.orderTypeCreate, input);

        const transaction = await OrderType.sequelize.transaction();

        try {
          const existingOrderType = await OrderType.findOne({
            where: {
              [Sequelize.Op.or]: [{ code: input.code }, { name: input.name }],
            },
          });

          if (existingOrderType) {
            throw new ApolloError(
              'An order type with the same code or name already exists',
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          const newOrderType = await OrderType.create(input, {
            transaction,
          });

          await transaction.commit();
          return newOrderType;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    orderTypeUpdate: combineResolvers(


      isAuthenticated,
      // hasPermission('orderType.update'),
      async (_, { id, input }) => {
        validateInput(validationSchemas.orderTypeUpdate, {
          id,
          ...input,
        });

        const transaction = await OrderType.sequelize.transaction();

        try {
          const orderType = await OrderType.findByPk(id);
          if (!orderType) {
            throw new ApolloError(
              'Order Type not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          if (
            (input.code && input.code !== orderType.code) ||
            (input.name && input.name !== orderType.name)
          ) {
            const existingOrderType = await OrderType.findOne({
              where: {
                [Sequelize.Op.or]: [{ code: input.code }, { name: input.name }],
                id: { [Sequelize.Op.ne]: id },
              },
            });

            if (existingOrderType) {
              throw new ApolloError(
                'An order type with the same code or name already exists',
                apolloErrorCodes.BAD_DATA_VALIDATION
              );
            }
          }

          await orderType.update(input, { transaction });

          await transaction.commit();
          return orderType;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    orderTypeDelete: combineResolvers(


      isAuthenticated,
      // hasPermission('orderType.delete'),
      async (_, { id }) => {
        validateInput(validationSchemas.orderTypeDelete, { id });

        const transaction = await OrderType.sequelize.transaction();

        try {
          const orderType = await OrderType.findByPk(id);
          if (!orderType) {
            throw new ApolloError(
              'Order Type not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          await orderType.destroy({ transaction });

          await transaction.commit();

          return orderType;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),
  },
};
