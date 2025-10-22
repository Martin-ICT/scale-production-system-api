const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize, where } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const Scale = require('../../models/scale');
const hasPermission = require('../../middlewares/hasPermission');

// Mapping GraphQL ENUM <-> Database values
const CAPACITY_MAP = {
  // GraphQL -> Database
  _3KG: '3',
  _6KG: '6',
  _9KG: '9',
  _12KG: '12',
  _15KG: '15',
  // Database -> GraphQL (string keys match DB ENUM values)
  3: '_3KG',
  6: '_6KG',
  9: '_9KG',
  12: '_12KG',
  15: '_15KG',
};

const UOM_MAP = {
  // GraphQL -> Database
  KG: 'kg',
  G: 'g',
  // Database -> GraphQL (string keys match DB ENUM values)
  kg: 'KG',
  g: 'G',
};

const validationSchemas = {
  scaleCreate: Joi.object({
    name: Joi.string().required(),
    deviceIP: Joi.string().ip().required(),
    deviceId: Joi.string().required(),
    brand: Joi.string().required(),
    plantCode: Joi.string().optional(),
    uom: Joi.string().valid('KG', 'G').required(),
    capacity: Joi.string()
      .valid('_3KG', '_6KG', '_9KG', '_12KG', '_15KG')
      .required(),
    lastCalibrate: Joi.date().optional(),
  }),
  scaleUpdate: Joi.object({
    id: Joi.number().integer().required(),
    name: Joi.string(),
    deviceIP: Joi.string().ip(),
    deviceId: Joi.string(),
    brand: Joi.string(),
    plantCode: Joi.string(),
    uom: Joi.string().valid('KG', 'G'),
    capacity: Joi.string().valid('_3KG', '_6KG', '_9KG', '_12KG', '_15KG'),
    lastCalibrate: Joi.date(),
  }),
  scaleDelete: Joi.object({
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
    scaleCount: combineResolvers(
      // hasPermission('scale.read'),
      async (_, { filter }) => {
        try {
          let whereClause = {};

          if (filter?.plantCode) {
            whereClause.plantCode = filter.plantCode;
          }

          if (filter?.capacity) {
            whereClause.capacity = CAPACITY_MAP[filter.capacity];
          }

          const count = await Scale.count({
            where: whereClause,
          });

          return { count };
        } catch (err) {
          throw err;
        }
      }
    ),

    scaleList: combineResolvers(
      // hasPermission('scale.read'),
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
              inColumns: ['deviceId', 'deviceIP'],
            });
          }

          if (filter?.plantCode) {
            whereClause.plantCode = filter.plantCode;
          }

          if (filter?.capacity) {
            // Convert GraphQL enum to DB value
            whereClause.capacity = CAPACITY_MAP[filter.capacity];
          }

          const countResult = await Scale.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await Scale.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
          });

          return {
            scales: result,
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

    scaleDetail: combineResolvers(
      // hasPermission('scale.read'),
      async (_, { id }) => {
        try {
          const scale = await Scale.findByPk(id);

          if (!scale) {
            throw new ApolloError(
              'Scale not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          return scale;
        } catch (err) {
          throw err;
        }
      }
    ),
  },

  Scale: {
    // Convert database value to GraphQL ENUM
    capacity: (scale) => {
      return CAPACITY_MAP[scale.capacity] || scale.capacity;
    },
    uom: (scale) => {
      return UOM_MAP[scale.uom] || scale.uom;
    },
  },

  Mutation: {
    scaleCreate: combineResolvers(
      // hasPermission('scale.create'),
      async (_, { input }) => {
        validateInput(validationSchemas.scaleCreate, input);

        // Convert GraphQL ENUM to database value
        if (input.capacity) {
          input.capacity = CAPACITY_MAP[input.capacity];
        }
        if (input.uom) {
          input.uom = UOM_MAP[input.uom];
        }

        const transaction = await Scale.sequelize.transaction();

        try {
          const existingScale = await Scale.findOne({
            where: {
              deviceIP: input.deviceIP,
            },
          });

          if (existingScale) {
            throw new ApolloError(
              'A scale with the same IP address already exists',
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          const newScale = await Scale.create(input, { transaction });

          // Manual ENUM conversion for GraphQL response
          // (Field resolvers don't work on transaction-bound instances)
          const result = newScale.toJSON();
          result.capacity = CAPACITY_MAP[result.capacity] || result.capacity;
          result.uom = UOM_MAP[result.uom] || result.uom;

          await transaction.commit();
          return result; // ✅ Return converted plain object
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    scaleUpdate: combineResolvers(
      // hasPermission('scale.update'),
      async (_, { id, input }) => {
        validateInput(validationSchemas.scaleUpdate, { id, ...input });

        // Convert GraphQL ENUM to database value
        if (input.capacity) {
          input.capacity = CAPACITY_MAP[input.capacity];
        }
        if (input.uom) {
          input.uom = UOM_MAP[input.uom];
        }

        const transaction = await Scale.sequelize.transaction();

        try {
          const scale = await Scale.findByPk(id);
          if (!scale) {
            throw new ApolloError(
              'Scale not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          if (input.deviceIP && input.deviceIP !== scale.deviceIP) {
            const existingScale = await Scale.findOne({
              where: {
                deviceIP: input.deviceIP,
                id: { [Sequelize.Op.ne]: id },
              },
            });

            if (existingScale) {
              throw new ApolloError(
                'A scale with the same IP address already exists',
                apolloErrorCodes.BAD_DATA_VALIDATION
              );
            }
          }

          await scale.update(input, { transaction });

          // Reload to get updated values
          await scale.reload({ transaction });

          // Manual ENUM conversion for GraphQL response
          // (Field resolvers don't work on transaction-bound instances)
          const result = scale.toJSON();
          result.capacity = CAPACITY_MAP[result.capacity] || result.capacity;
          result.uom = UOM_MAP[result.uom] || result.uom;

          await transaction.commit();
          return result;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    scaleDelete: combineResolvers(
      // hasPermission('scale.delete'),
      async (_, { id }) => {
        validateInput(validationSchemas.scaleDelete, { id });

        const transaction = await Scale.sequelize.transaction();

        try {
          const scale = await Scale.findByPk(id);
          if (!scale) {
            throw new ApolloError(
              'Scale not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          await scale.destroy({ transaction, force: true });

          await transaction.commit();

          return scale;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),
  },
};
