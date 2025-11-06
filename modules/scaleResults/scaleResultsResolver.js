const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const ScaleResults = require('../../models/scaleResults');
const hasPermission = require('../../middlewares/hasPermission');
const isAuthenticated = require('../../middlewares/isAuthenticated');

const validationSchemas = {
  scaleResultsCreate: Joi.object({
    scaleId: Joi.string().required().max(10),
    productionOrderNumber: Joi.string().max(20).optional(),
    plant: Joi.string().max(4).optional(),
    materialCode: Joi.string().max(10).optional(),
    materialUom: Joi.string().max(10).optional(),
    weight: Joi.number().optional(),
    uom: Joi.string().max(10).optional(),
    weightConverted: Joi.number().optional(),
    productionGroup: Joi.string().max(2).optional(),
    productionShift: Joi.number().integer().optional(),
    packingGroup: Joi.string().max(2).optional(),
    packingShift: Joi.number().integer().optional(),
    productionLot: Joi.string().max(2).optional(),
    productionLocation: Joi.string().max(2).optional(),
    storageLocation: Joi.string().max(4).optional(),
    scaleTransactionId: Joi.string().max(30).optional(),
    transactionType: Joi.string().max(2).valid('GI', 'GR').optional(),
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
    scaleResultsList: combineResolvers(
      isAuthenticated,
      // hasPermission('scaleResults.read'),
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

          // Apply filters
          if (filter?.scaleId) {
            whereClause.scaleId = filter.scaleId;
          }
          if (filter?.productionOrderNumber) {
            whereClause.productionOrderNumber = filter.productionOrderNumber;
          }
          if (filter?.materialCode) {
            whereClause.materialCode = filter.materialCode;
          }
          if (filter?.productionGroup) {
            whereClause.productionGroup = filter.productionGroup;
          }
          if (filter?.packingGroup) {
            whereClause.packingGroup = filter.packingGroup;
          }
          if (filter?.productionLot) {
            whereClause.productionLot = filter.productionLot;
          }
          if (filter?.userId) {
            whereClause.userId = filter.userId;
          }
          if (filter?.username) {
            whereClause.username = filter.username;
          }
          if (filter?.storageLocation) {
            whereClause.storageLocation = filter.storageLocation;
          }
          if (filter?.scaleTransactionId) {
            whereClause.scaleTransactionId = filter.scaleTransactionId;
          }
          if (filter?.transactionType) {
            whereClause.transactionType = filter.transactionType;
          }
          if (filter?.isProcessed !== undefined) {
            whereClause.isProcessed = filter.isProcessed;
          }

          // Apply search if provided
          if (search) {
            const searchClause = {
              [Sequelize.Op.or]: [
                { scaleId: { [Sequelize.Op.iLike]: `%${search}%` } },
                {
                  productionOrderNumber: {
                    [Sequelize.Op.iLike]: `%${search}%`,
                  },
                },
                { materialCode: { [Sequelize.Op.iLike]: `%${search}%` } },
                { scaleTransactionId: { [Sequelize.Op.iLike]: `%${search}%` } },
                { username: { [Sequelize.Op.iLike]: `%${search}%` } },
              ],
            };
            // Combine filters and search using AND if there are filters
            if (Object.keys(whereClause).length > 0) {
              whereClause = {
                [Sequelize.Op.and]: [whereClause, searchClause],
              };
            } else {
              whereClause = searchClause;
            }
          }

          const countResult = await ScaleResults.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await ScaleResults.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
          });

          // Map weight_converted to weightConverted for GraphQL response
          const scaleResults = result.map((item) => {
            const itemData = item.toJSON();
            itemData.weightConverted = itemData.weight_converted;
            delete itemData.weight_converted;
            return itemData;
          });

          return {
            scaleResults: scaleResults,
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

    scaleResultsDetail: combineResolvers(
      isAuthenticated,
      // hasPermission('scaleResults.read'),
      async (_, { id }) => {
        try {
          const scaleResult = await ScaleResults.findByPk(id);

          if (!scaleResult) {
            throw new ApolloError(
              'ScaleResults not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Map weight_converted to weightConverted for GraphQL response
          const result = scaleResult.toJSON();
          result.weightConverted = result.weight_converted;
          delete result.weight_converted;

          return result;
        } catch (err) {
          throw err;
        }
      }
    ),

    scaleResultsListByScale: combineResolvers(
      isAuthenticated,
      // hasPermission('scaleResults.read'),
      pageMinCheckAndPageSizeMax,
      async (
        _,
        {
          scaleId,
          page = 0,
          pageSize = 10,
          sort = { columnName: 'createdAt', sortOrder: 'DESC' },
        }
      ) => {
        try {
          const whereClause = {
            scaleId: scaleId,
          };

          const countResult = await ScaleResults.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await ScaleResults.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
          });

          // Map weight_converted to weightConverted for GraphQL response
          const scaleResults = result.map((item) => {
            const itemData = item.toJSON();
            itemData.weightConverted = itemData.weight_converted;
            delete itemData.weight_converted;
            return itemData;
          });

          return {
            scaleResults: scaleResults,
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
    scaleResultsCreate: combineResolvers(
      isAuthenticated,
      // hasPermission('scaleResults.create'),
      async (_, { input }, { user }) => {
        validateInput(validationSchemas.scaleResultsCreate, input);
        const transaction = await ScaleResults.sequelize.transaction();

        try {
          // Map weightConverted to weight_converted for database
          const payload = {
            scaleId: input.scaleId,
            productionOrderNumber: input.productionOrderNumber,
            plant: input.plant,
            materialCode: input.materialCode,
            materialUom: input.materialUom,
            weight: input.weight,
            uom: input.uom,
            weight_converted: input.weightConverted,
            productionGroup: input.productionGroup,
            productionShift: input.productionShift,
            packingGroup: input.packingGroup,
            packingShift: input.packingShift,
            productionLot: input.productionLot,
            productionLocation: input.productionLocation,
            userId: user?.userId || null,
            username: user?.name || null,
            storageLocation: input.storageLocation,
            scaleTransactionId: input.scaleTransactionId,
            transactionType: input.transactionType,
          };

          const newScaleResults = await ScaleResults.create(payload, {
            transaction,
          });

          await transaction.commit();

          // Map weight_converted back to weightConverted for GraphQL response
          const result = newScaleResults.toJSON();
          result.weightConverted = result.weight_converted;
          delete result.weight_converted;

          return result;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),
  },
};
