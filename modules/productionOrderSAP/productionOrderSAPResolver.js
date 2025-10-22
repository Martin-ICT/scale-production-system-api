const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize, where } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const ProductionOrderSAP = require('../../models/productionOrderSAP');
const hasPermission = require('../../middlewares/hasPermission');

const validationSchemas = {
  productionOrderSAPCreate: Joi.object({
    productionOrderNumber: Joi.string().required().min(1).max(255),
    plantCode: Joi.string().required(),
    orderTypeCode: Joi.number().integer().required(),
    materialCode: Joi.string().required(),
    targetWeight: Joi.number().integer().required().min(1),
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
    productionOrderSAPList: combineResolvers(
      // hasPermission('productionOrderSAP.read'),
      pageMinCheckAndPageSizeMax,
      async (
        _,
        {
          page = 0,
          pageSize = 10,
          search = null,
          sort = { columnName: 'createdAt', sortOrder: 'DESC' },
          filter,
        }
      ) => {
        try {
          let whereClause = {};

          if (search) {
            whereClause = definedSearch({
              query: search,
              inColumns: ['productionOrderNumber', 'materialCode'],
            });
          }

          if (filter?.plantCode) {
            whereClause.plantCode = filter.plantCode;
          }

          if (filter?.orderTypeCode) {
            whereClause.orderTypeCode = filter.orderTypeCode;
          }

          if (filter?.materialCode) {
            whereClause.materialCode = filter.materialCode;
          }

          const countResult = await ProductionOrderSAP.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await ProductionOrderSAP.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
          });

          return {
            productionOrderSAPs: result,
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

    productionOrderSAPDetail: combineResolvers(
      // hasPermission('productionOrderSAP.read'),
      async (_, { id }) => {
        try {
          const productionOrderSAP = await ProductionOrderSAP.findByPk(id);

          if (!productionOrderSAP) {
            throw new ApolloError(
              'ProductionOrderSAP not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          return productionOrderSAP;
        } catch (err) {
          throw err;
        }
      }
    ),
  },

  Mutation: {
    productionOrderSAPCreate: combineResolvers(
      // hasPermission('productionOrderSAP.create'),
      async (_, { input }, { user }) => {
        validateInput(validationSchemas.productionOrderSAPCreate, input);
        const transaction = await ProductionOrderSAP.sequelize.transaction();

        try {
          const existingProductionOrderSAP = await ProductionOrderSAP.findOne({
            where: {
              productionOrderNumber: input.productionOrderNumber,
              materialCode: input.materialCode,
            },
          });

          if (existingProductionOrderSAP) {
            throw new ApolloError(
              'A production order with the same number and material code already exists',
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          const newProductionOrderSAP = await ProductionOrderSAP.create(input, {
            transaction,
          });
          await transaction.commit();
          return newProductionOrderSAP;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),
  },
};
