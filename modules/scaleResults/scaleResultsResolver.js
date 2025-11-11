const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const ScaleResults = require('../../models/scaleResults');
const hasPermission = require('../../middlewares/hasPermission');
const isAuthenticated = require('../../middlewares/isAuthenticated');

const validationSchemas = {
  scaleResultsCreate: Joi.object({
    scaleId: Joi.string().required().max(10),
    productionOrderNumber: Joi.string().max(20).optional().allow(null, ''),
    plantCode: Joi.string().max(10).optional().allow(null, ''),
    materialCode: Joi.string().max(10).optional().allow(null, ''),
    materialUom: Joi.string().max(10).optional().allow(null, ''),
    weight: Joi.number().optional().allow(null),
    uom: Joi.string().max(10).optional().allow(null, ''),
    weightConverted: Joi.number().optional().allow(null),
    productionGroup: Joi.string().max(2).optional().allow(null, ''),
    productionShift: Joi.number().integer().optional().allow(null),
    packingGroup: Joi.string().max(10).optional().allow(null, ''),
    packingShift: Joi.number().integer().optional().allow(null),
    productionLot: Joi.string().max(10).optional().allow(null, ''),
    productionLocation: Joi.string().max(10).optional().allow(null, ''),
    storageLocation: Joi.string().max(10).optional().allow(null, ''),
    scaleTransactionId: Joi.string().max(30).optional().allow(null, ''),
    transactionType: Joi.string()
      .max(2)
      .valid('GI', 'GR')
      .optional()
      .allow(null, ''),
    isSummarized: Joi.boolean().optional(),
  }),
  scaleResultsBatchCreate: Joi.object({
    scaleResults: Joi.array()
      .items(
        Joi.object({
          scaleId: Joi.string().required().max(10),
          productionOrderNumber: Joi.string()
            .max(20)
            .optional()
            .allow(null, ''),
          plantCode: Joi.string().max(10).optional().allow(null, ''),
          materialCode: Joi.string().max(10).optional().allow(null, ''),
          materialUom: Joi.string().max(10).optional().allow(null, ''),
          weight: Joi.number().optional().allow(null),
          uom: Joi.string().max(10).optional().allow(null, ''),
          weightConverted: Joi.number().optional().allow(null),
          productionGroup: Joi.string().max(2).optional().allow(null, ''),
          productionShift: Joi.number().integer().optional().allow(null),
          packingGroup: Joi.string().max(10).optional().allow(null, ''),
          packingShift: Joi.number().integer().optional().allow(null),
          productionLot: Joi.string().max(10).optional().allow(null, ''),
          productionLocation: Joi.string().max(10).optional().allow(null, ''),
          storageLocation: Joi.string().max(10).optional().allow(null, ''),
          scaleTransactionId: Joi.string().max(30).optional().allow(null, ''),
          transactionType: Joi.string()
            .max(2)
            .valid('GI', 'GR')
            .optional()
            .allow(null, ''),
          isSummarized: Joi.boolean().optional(),
        })
      )
      .min(1)
      .required(),
  }),
  scaleResultsUpdate: Joi.object({
    productionOrderNumber: Joi.string().max(20).optional().allow(null, ''),
    plantCode: Joi.string().max(10).optional().allow(null, ''),
    materialCode: Joi.string().max(10).optional().allow(null, ''),
    materialUom: Joi.string().max(10).optional().allow(null, ''),
    weight: Joi.number().optional().allow(null),
    uom: Joi.string().max(10).optional().allow(null, ''),
    weightConverted: Joi.number().optional().allow(null),
    productionGroup: Joi.string().max(2).optional().allow(null, ''),
    productionShift: Joi.number().integer().optional().allow(null),
    packingGroup: Joi.string().max(10).optional().allow(null, ''),
    packingShift: Joi.number().integer().optional().allow(null),
    productionLot: Joi.string().max(10).optional().allow(null, ''),
    productionLocation: Joi.string().max(10).optional().allow(null, ''),
    storageLocation: Joi.string().max(10).optional().allow(null, ''),
    transactionType: Joi.string()
      .max(2)
      .valid('GI', 'GR')
      .optional()
      .allow(null, ''),
    isSummarized: Joi.boolean().optional(),
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

// Helper function to map weightConverted to weight_converted and vice versa
const mapScaleResultForDB = (input) => {
  const payload = { ...input };
  if (payload.weightConverted !== undefined) {
    payload.weight_converted = payload.weightConverted;
    delete payload.weightConverted;
  }
  return payload;
};

const mapScaleResultForResponse = (result) => {
  const data = result.toJSON ? result.toJSON() : result;
  if (data.weight_converted !== undefined) {
    data.weightConverted = data.weight_converted;
    delete data.weight_converted;
  }
  return data;
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
          if (filter?.plantCode) {
            whereClause.plantCode = filter.plantCode;
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
          if (filter?.isSummarized !== undefined) {
            whereClause.isSummarized = filter.isSummarized;
          }

          // Apply search if provided
          if (search) {
            whereClause = definedSearch({
              query: search,
              inColumns: [
                'scaleId',
                'productionOrderNumber',
                'materialCode',
                'scaleTransactionId',
                'username',
              ],
            });
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
          const scaleResults = result.map(mapScaleResultForResponse);

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

          return mapScaleResultForResponse(scaleResult);
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
          const scaleResults = result.map(mapScaleResultForResponse);

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
          const payload = mapScaleResultForDB({
            scaleId: input.scaleId,
            productionOrderNumber: input.productionOrderNumber,
            plantCode: input.plantCode,
            materialCode: input.materialCode,
            materialUom: input.materialUom,
            weight: input.weight,
            uom: input.uom,
            weightConverted: input.weightConverted,
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
            isSummarized: input.isSummarized ?? false,
          });

          const newScaleResults = await ScaleResults.create(payload, {
            transaction,
          });

          await transaction.commit();

          return mapScaleResultForResponse(newScaleResults);
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    scaleResultsBatchCreate: combineResolvers(
      isAuthenticated,
      // hasPermission('scaleResults.create'),
      async (_, { input }, { user }) => {
        validateInput(validationSchemas.scaleResultsBatchCreate, input);
        const transaction = await ScaleResults.sequelize.transaction();

        try {
          // Map all inputs for database
          const payloadsToCreate = input.scaleResults.map((item) =>
            mapScaleResultForDB({
              scaleId: item.scaleId,
              productionOrderNumber: item.productionOrderNumber,
              plantCode: item.plantCode,
              materialCode: item.materialCode,
              materialUom: item.materialUom,
              weight: item.weight,
              uom: item.uom,
              weightConverted: item.weightConverted,
              productionGroup: item.productionGroup,
              productionShift: item.productionShift,
              packingGroup: item.packingGroup,
              packingShift: item.packingShift,
              productionLot: item.productionLot,
              productionLocation: item.productionLocation,
              userId: user?.userId || null,
              username: user?.name || null,
              storageLocation: item.storageLocation,
              scaleTransactionId: item.scaleTransactionId,
              transactionType: item.transactionType,
              isSummarized: item.isSummarized ?? false,
            })
          );

          const newScaleResults = await ScaleResults.bulkCreate(
            payloadsToCreate,
            {
              transaction,
              returning: true,
            }
          );

          await transaction.commit();

          // Map weight_converted back to weightConverted for GraphQL response
          return newScaleResults.map(mapScaleResultForResponse);
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    scaleResultsUpdate: combineResolvers(
      isAuthenticated,
      // hasPermission('scaleResults.update'),
      async (_, { id, input }, { user }) => {
        validateInput(validationSchemas.scaleResultsUpdate, input);
        const transaction = await ScaleResults.sequelize.transaction();

        try {
          const scaleResult = await ScaleResults.findByPk(id);

          if (!scaleResult) {
            throw new ApolloError(
              'ScaleResults not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Map weightConverted to weight_converted for database
          const updatePayload = mapScaleResultForDB(input);

          await scaleResult.update(updatePayload, { transaction });

          await transaction.commit();

          return mapScaleResultForResponse(scaleResult);
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    scaleResultsDelete: combineResolvers(
      isAuthenticated,
      // hasPermission('scaleResults.delete'),
      async (_, { id }) => {
        const transaction = await ScaleResults.sequelize.transaction();

        try {
          const scaleResult = await ScaleResults.findByPk(id);

          if (!scaleResult) {
            throw new ApolloError(
              'ScaleResults not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          await scaleResult.destroy({ transaction, force: true });

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
