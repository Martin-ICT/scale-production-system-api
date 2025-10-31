const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize, where } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const ProductionOrderSAP = require('../../models/productionOrderSAP');
const Material = require('../../models/material');
const MaterialUom = require('../../models/materialUom');
const hasPermission = require('../../middlewares/hasPermission');
const isAuthenticated = require('../../middlewares/isAuthenticated');

const validationSchemas = {
  productionOrderSAPCreate: Joi.object({
    productionOrderNumber: Joi.string().required().min(1).max(255),
    plantCode: Joi.string().required(),
    orderTypeCode: Joi.string().required().max(4),
    materialCode: Joi.string().required(),
    targetWeight: Joi.number().integer().required().min(1),
  }),
  productionOrderSAPUpdateStatus: Joi.object({
    id: Joi.number().integer().required(),
    status: Joi.number().integer().required().min(0),
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
      isAuthenticated,
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

          if (filter?.status !== undefined) {
            whereClause.status = filter.status;
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
      isAuthenticated,
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
      isAuthenticated,
      // hasPermission('productionOrderSAP.create'),
      async (_, { input }, { user }) => {
        validateInput(validationSchemas.productionOrderSAPCreate, input);
        const transaction = await ProductionOrderSAP.sequelize.transaction();

        try {
          // Fetch material from WMS by material code to derive UOM (and validate existence)
          const material = await Material.findOne({
            where: {
              code: input.materialCode,
              ad_client_id: 1000009,
            },
            include: [
              {
                model: MaterialUom,
                as: 'uom',
                attributes: ['code'],
                where: { ad_client_id: 1000009 },
                required: false,
              },
            ],
          });

          if (!material) {
            throw new ApolloError(
              'Material not found in WMS for provided materialCode',
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

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

          const payload = {
            productionOrderNumber: input.productionOrderNumber,
            plantCode: input.plantCode,
            orderTypeCode: input.orderTypeCode,
            materialCode: input.materialCode,
            targetWeight: input.targetWeight,
            productionDate: input.productionDate,
            suitability: input.suitability,
            // optional/derived with safe defaults if not provided
            uom: input.uom ?? material?.uom?.code ?? 'KG',
            status: input.status ?? 0,
          };

          const newProductionOrderSAP = await ProductionOrderSAP.create(
            payload,
            {
              transaction,
            }
          );

          await transaction.commit();
          return newProductionOrderSAP;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    productionOrderSAPUpdateStatus: combineResolvers(
      isAuthenticated,
      // hasPermission('productionOrderSAP.update'),
      async (_, { id, status }) => {
        validateInput(validationSchemas.productionOrderSAPUpdateStatus, {
          id,
          status,
        });

        const transaction = await ProductionOrderSAP.sequelize.transaction();

        try {
          const productionOrderSAP = await ProductionOrderSAP.findByPk(id);
          if (!productionOrderSAP) {
            throw new ApolloError(
              'Production Order SAP not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          await productionOrderSAP.update({ status }, { transaction });

          await transaction.commit();
          return productionOrderSAP;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),
  },
};
