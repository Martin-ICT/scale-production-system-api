const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const ProductionOrderDetail = require('../../models/productionOrderDetail');
const ProductionOrderSAP = require('../../models/productionOrderSAP');
const OrderType = require('../../models/orderType');
const Material = require('../../models/material');
const MaterialUom = require('../../models/materialUom');
const hasPermission = require('../../middlewares/hasPermission');
const isAuthenticated = require('../../middlewares/isAuthenticated');

const validationSchemas = {
  productionOrderDetailCreate: Joi.object({
    productionOrderId: Joi.number().integer().required(),
    materialCode: Joi.string().required().min(1).max(255),
    targetWeight: Joi.number().integer().required().min(1),
    processingType: Joi.number().integer().required(),
    orderTypeId: Joi.number().integer().optional(),
    totalWeighed: Joi.number().min(0).optional(),
    totalWeighedGoodReceive: Joi.number().min(0).optional(),
    weighingCount: Joi.number().integer().min(0).optional(),
  }),
  productionOrderDetailUpdate: Joi.object({
    materialCode: Joi.string().min(1).max(255).optional(),
    targetWeight: Joi.number().integer().min(1).optional(),
    processingType: Joi.number().integer().optional(),
    orderTypeId: Joi.number().integer().optional(),
    totalWeighed: Joi.number().min(0).optional(),
    totalWeighedGoodReceive: Joi.number().min(0).optional(),
    weighingCount: Joi.number().integer().min(0).optional(),
  }),
  productionOrderDetailUpdateTotalWeighed: Joi.object({
    id: Joi.number().integer().required(),
    totalWeighed: Joi.number().min(0).required(),
    totalWeighedGoodReceive: Joi.number().min(0).optional(),
    weighingCount: Joi.number().integer().min(0).optional(),
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
    productionOrderDetailList: combineResolvers(
      isAuthenticated,
      // hasPermission('productionOrderDetail.read'),
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
              inColumns: ['materialCode', 'materialDescription'],
            });
          }

          if (filter?.productionOrderId) {
            whereClause.productionOrderId = filter.productionOrderId;
          }

          if (filter?.materialCode) {
            whereClause.materialCode = filter.materialCode;
          }

          if (filter?.processingType !== undefined) {
            whereClause.processingType = filter.processingType;
          }

          if (filter?.orderTypeId !== undefined) {
            whereClause.orderTypeId = filter.orderTypeId;
          }

          const countResult = await ProductionOrderDetail.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await ProductionOrderDetail.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
            include: [
              {
                model: ProductionOrderSAP,
                as: 'productionOrderSAP',
                attributes: [
                  'id',
                  'productionOrderNumber',
                  'plantCode',
                  'orderTypeCode',
                  'materialCode',
                  'targetWeight',
                  'productionDate',
                  'suitability',
                  'status',
                  'createdAt',
                ],
                required: false,
              },
              {
                model: OrderType,
                as: 'orderType',
                required: false,
                attributes: ['id', 'code', 'name', 'processType', 'maxDay'],
              },
            ],
          });

          return {
            productionOrderDetails: result,
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

    productionOrderDetailDetail: combineResolvers(
      isAuthenticated,
      // hasPermission('productionOrderDetail.read'),
      async (_, { id }) => {
        try {
          const productionOrderDetail = await ProductionOrderDetail.findByPk(
            id,
            {
              include: [
                {
                  model: ProductionOrderSAP,
                  as: 'productionOrderSAP',
                  required: false,
                  attributes: [
                    'id',
                    'productionOrderNumber',
                    'plantCode',
                    'orderTypeCode',
                    'materialCode',
                    'targetWeight',
                    'productionDate',
                    'suitability',
                    'status',
                    'createdAt',
                  ],
                },
                {
                  model: OrderType,
                  as: 'orderType',
                  required: false,
                },
              ],
            }
          );

          if (!productionOrderDetail) {
            throw new ApolloError(
              'ProductionOrderDetail not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          return productionOrderDetail;
        } catch (err) {
          throw err;
        }
      }
    ),

    productionOrderDetailListByProductionOrder: combineResolvers(
      isAuthenticated,
      // hasPermission('productionOrderDetail.read'),
      pageMinCheckAndPageSizeMax,
      async (
        _,
        {
          productionOrderId,
          page = 0,
          pageSize = 10,
          sort = { columnName: 'createdAt', sortOrder: 'ASC' },
        }
      ) => {
        try {
          const whereClause = {
            productionOrderId: productionOrderId,
          };

          const countResult = await ProductionOrderDetail.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await ProductionOrderDetail.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
            include: [
              {
                model: ProductionOrderSAP,
                as: 'productionOrderSAP',
                attributes: [
                  'id',
                  'productionOrderNumber',
                  'plantCode',
                  'orderTypeCode',
                  'materialCode',
                  'targetWeight',
                  'productionDate',
                  'suitability',
                  'status',
                  'createdAt',
                ],
                required: false,
              },
              {
                model: OrderType,
                as: 'orderType',
                required: false,
                attributes: ['id', 'code', 'name', 'processType', 'maxDay'],
              },
            ],
          });

          return {
            productionOrderDetails: result,
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
  },

  Mutation: {
    productionOrderDetailCreate: combineResolvers(
      isAuthenticated,
      // hasPermission('productionOrderDetail.create'),
      async (_, { input }, { user }) => {
        validateInput(validationSchemas.productionOrderDetailCreate, input);
        const transaction = await ProductionOrderDetail.sequelize.transaction();

        try {
          // Validate productionOrderSAP exists
          const productionOrderSAP = await ProductionOrderSAP.findByPk(
            input.productionOrderId
          );

          if (!productionOrderSAP) {
            throw new ApolloError(
              'Production Order SAP not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Fetch material from WMS by material code to validate and get UOM
          const material = await Material.findOne({
            where: {
              code: input.materialCode,
              clientId: 1000009,
            },
            include: [
              {
                model: MaterialUom,
                as: 'uom',
                attributes: ['code'],
                where: { clientId: 1000009 },
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

          // Get orderTypeId from orderTypeCode in productionOrderSAP
          // Take only last 2 characters from orderTypeCode
          let orderTypeId = null;
          if (productionOrderSAP.orderTypeCode) {
            const orderTypeCode = productionOrderSAP.orderTypeCode;
            const lastTwoChars =
              orderTypeCode.length >= 2
                ? orderTypeCode.slice(-2)
                : orderTypeCode;

            const orderType = await OrderType.findOne({
              where: {
                code: lastTwoChars,
              },
              attributes: ['id', 'code', 'name', 'processType', 'maxDay'],
            });

            if (orderType) {
              orderTypeId = orderType.id;
            }
          }

          const payload = {
            productionOrderId: input.productionOrderId,
            materialCode: input.materialCode,
            materialDescription: material?.name,
            materialUom: material?.uom?.code,
            targetWeight: input.targetWeight,
            processingType: input.processingType,
            orderTypeId: orderTypeId,
            totalWeighed: input.totalWeighed ?? 0,
            totalWeighedGoodReceive: input.totalWeighedGoodReceive ?? 0,
            weighingCount: input.weighingCount ?? 0,
            createdBy: user?.id || null,
          };

          const newProductionOrderDetail = await ProductionOrderDetail.create(
            payload,
            {
              transaction,
            }
          );

          await transaction.commit();
          return newProductionOrderDetail;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    productionOrderDetailUpdate: combineResolvers(
      isAuthenticated,
      // hasPermission('productionOrderDetail.update'),
      async (_, { id, input }, { user }) => {
        validateInput(validationSchemas.productionOrderDetailUpdate, input);

        const transaction = await ProductionOrderDetail.sequelize.transaction();

        try {
          const productionOrderDetail = await ProductionOrderDetail.findByPk(
            id
          );

          if (!productionOrderDetail) {
            throw new ApolloError(
              'Production Order Detail not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // If materialCode is being updated, validate it exists in WMS
          if (input.materialCode) {
            const material = await Material.findOne({
              where: {
                code: input.materialCode,
                clientId: 1000009,
              },
              include: [
                {
                  model: MaterialUom,
                  as: 'uom',
                  attributes: ['code'],
                  where: { clientId: 1000009 },
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

            // Auto-update description and UOM from material if materialCode changed
            input.materialDescription = material?.name || input.materialCode;
            input.materialUom = material?.uom?.code || 'KG';
          }

          // Validate orderTypeId if provided
          if (input.orderTypeId !== undefined) {
            if (input.orderTypeId === null) {
              // Allow setting to null
              input.orderTypeId = null;
            } else {
              const orderType = await OrderType.findByPk(input.orderTypeId, {
                attributes: ['id', 'code', 'name', 'processType', 'maxDay'],
              });
              if (!orderType) {
                throw new ApolloError(
                  'Order Type not found',
                  apolloErrorCodes.NOT_FOUND
                );
              }
            }
          }

          const updatePayload = {
            ...input,
            updatedBy: user?.id || null,
          };

          await productionOrderDetail.update(updatePayload, {
            transaction,
          });

          await transaction.commit();
          return productionOrderDetail;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    productionOrderDetailUpdateTotalWeighed: combineResolvers(
      isAuthenticated,
      // hasPermission('productionOrderDetail.update'),
      async (
        _,
        { id, totalWeighed, totalWeighedGoodReceive, weighingCount },
        { user }
      ) => {
        validateInput(
          validationSchemas.productionOrderDetailUpdateTotalWeighed,
          {
            id,
            totalWeighed,
            totalWeighedGoodReceive,
            weighingCount,
          }
        );

        const transaction = await ProductionOrderDetail.sequelize.transaction();

        try {
          const productionOrderDetail = await ProductionOrderDetail.findByPk(
            id
          );

          if (!productionOrderDetail) {
            throw new ApolloError(
              'Production Order Detail not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          const updatePayload = {
            totalWeighed,
            updatedBy: user?.id || null,
          };

          if (totalWeighedGoodReceive !== undefined) {
            updatePayload.totalWeighedGoodReceive = totalWeighedGoodReceive;
          }

          if (weighingCount !== undefined) {
            updatePayload.weighingCount = weighingCount;
          } else {
            // Auto increment if not provided
            updatePayload.weighingCount =
              (productionOrderDetail.weighingCount || 0) + 1;
          }

          await productionOrderDetail.update(updatePayload, {
            transaction,
          });

          await transaction.commit();
          return productionOrderDetail;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    productionOrderDetailDelete: combineResolvers(
      isAuthenticated,
      // hasPermission('productionOrderDetail.delete'),
      async (_, { id }) => {
        const transaction = await ProductionOrderDetail.sequelize.transaction();

        try {
          const productionOrderDetail = await ProductionOrderDetail.findByPk(
            id
          );

          if (!productionOrderDetail) {
            throw new ApolloError(
              'Production Order Detail not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          await productionOrderDetail.destroy({ transaction });

          await transaction.commit();
          return true;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),
  },
};
