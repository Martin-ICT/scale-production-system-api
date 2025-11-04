const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
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
    userId: Joi.number().integer().optional(),
    username: Joi.string().max(50).optional(),
    storageLocation: Joi.string().max(4).optional(),
    scaleTransactionId: Joi.string().max(30).optional(),
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
  Query: {},
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
            userId: input.userId || user?.id || null,
            username: input.username,
            storageLocation: input.storageLocation,
            scaleTransactionId: input.scaleTransactionId,
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

