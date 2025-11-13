const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize, where } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const Scale = require('../../models/scale');
const ScaleAssignment = require('../../models/scaleAssignment');
const ProductionOrderDetail = require('../../models/productionOrderDetail');
const ProductionOrderSAP = require('../../models/productionOrderSAP');
const OrderType = require('../../models/orderType');
const hasPermission = require('../../middlewares/hasPermission');
const isAuthenticated = require('../../middlewares/isAuthenticated');

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

const STATUS_MAP = {
  // GraphQL -> Database
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  // Database -> GraphQL (string keys match DB ENUM values)
  active: 'ACTIVE',
  inactive: 'INACTIVE',
};

const validationSchemas = {
  scaleCreate: Joi.object({
    name: Joi.string().required(),
    deviceIP: Joi.string().ip().required(),
    deviceId: Joi.string().required(),
    brand: Joi.string().required(),
    plantCode: Joi.string().optional(),
    uom: Joi.string().valid('KG', 'G').required(),
    capacity: Joi.string().required(),
    lastCalibrate: Joi.date().optional(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE').optional(),
  }),
  scaleUpdate: Joi.object({
    id: Joi.number().integer().required(),
    name: Joi.string(),
    deviceIP: Joi.string().ip(),
    deviceId: Joi.string(),
    brand: Joi.string(),
    plantCode: Joi.string(),
    uom: Joi.string().valid('KG', 'G'),
    capacity: Joi.string(),
    lastCalibrate: Joi.date(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE'),
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
      isAuthenticated,
      // hasPermission('scale.read'),
      async (_, { filter }) => {
        try {
          let whereClause = {};

          if (filter?.plantCode) {
            whereClause.plantCode = filter.plantCode;
          }

          if (filter?.capacity) {
            // Use capacity value directly from database
            whereClause.capacity = filter.capacity;
          }

          if (filter?.status) {
            whereClause.status = STATUS_MAP[filter.status];
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
      isAuthenticated,
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
            // Use capacity value directly from database
            whereClause.capacity = filter.capacity;
          }

          if (filter?.status) {
            whereClause.status = STATUS_MAP[filter.status];
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
            include: [
              {
                model: ScaleAssignment,
                as: 'scaleAssignments',
                required: false,
                where: {
                  deletedAt: null,
                },
                include: [
                  {
                    model: ProductionOrderDetail,
                    as: 'productionOrderDetail',
                    required: false,
                    include: [
                      {
                        model: OrderType,
                        as: 'orderType',
                        required: false,
                      },
                    ],
                  },
                ],
              },
            ],
          });

          // Convert enum values from database to GraphQL enum format (except capacity)
          const scales = result.map((scale) => {
            const scaleData = scale.toJSON();
            // Convert uom and status from database values to GraphQL enum
            // Capacity: keep as is from database
            if (scaleData.uom != null) {
              scaleData.uom =
                UOM_MAP[String(scaleData.uom).toLowerCase()] ||
                scaleData.uom.toUpperCase();
            }
            if (scaleData.status != null) {
              scaleData.status =
                STATUS_MAP[String(scaleData.status).toLowerCase()] ||
                scaleData.status.toUpperCase();
            }
            // Extract productionOrderDetails from scaleAssignments
            if (
              scaleData.scaleAssignments &&
              scaleData.scaleAssignments.length > 0
            ) {
              scaleData.productionOrderDetails = scaleData.scaleAssignments
                .map((assignment) => assignment.productionOrderDetail)
                .filter((detail) => detail !== null && detail !== undefined);
            } else {
              scaleData.productionOrderDetails = [];
            }
            // Remove scaleAssignments from response as we only need productionOrderDetails
            delete scaleData.scaleAssignments;
            return scaleData;
          });

          // Collect all productionOrderIds from all scales
          const productionOrderIds = [
            ...new Set(
              scales
                .flatMap((scale) => scale.productionOrderDetails || [])
                .map((detail) => detail?.productionOrderId)
                .filter((id) => id !== null && id !== undefined)
            ),
          ];

          // Fetch all ProductionOrderSAP records in one query
          const productionOrderSAPMap = new Map();
          if (productionOrderIds.length > 0) {
            const productionOrderSAPs = await ProductionOrderSAP.findAll({
              where: {
                id: { [Sequelize.Op.in]: productionOrderIds },
              },
            });

            productionOrderSAPs.forEach((sap) => {
              productionOrderSAPMap.set(sap.id, sap.toJSON());
            });
          }

          // Attach ProductionOrderSAP to each productionOrderDetail
          scales.forEach((scale) => {
            if (
              scale.productionOrderDetails &&
              scale.productionOrderDetails.length > 0
            ) {
              scale.productionOrderDetails = scale.productionOrderDetails
                .map((detail) => {
                  if (!detail) return null;

                  const productionOrderSAP = productionOrderSAPMap.get(
                    detail.productionOrderId
                  );

                  // Only include detail if it has productionOrderSAP with productionOrderNumber
                  if (
                    productionOrderSAP &&
                    productionOrderSAP.productionOrderNumber
                  ) {
                    detail.productionOrderSAP = productionOrderSAP;
                    return detail;
                  }
                  return null;
                })
                .filter((detail) => detail !== null && detail !== undefined);
            }
          });

          return {
            scales: scales,
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
      isAuthenticated,
      // hasPermission('scale.read'),
      async (_, { id }) => {
        try {
          const scale = await Scale.findByPk(id, {
            include: [
              {
                model: ScaleAssignment,
                as: 'scaleAssignments',
                required: false,
                where: {
                  deletedAt: null,
                },
                include: [
                  {
                    model: ProductionOrderDetail,
                    as: 'productionOrderDetail',
                    required: false,
                    include: [
                      {
                        model: OrderType,
                        as: 'orderType',
                        required: false,
                      },
                    ],
                  },
                ],
              },
            ],
          });

          if (!scale) {
            throw new ApolloError(
              'Scale not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Convert enum values from database to GraphQL enum format (except capacity)
          const scaleData = scale.toJSON();
          // Capacity: keep as is from database
          if (scaleData.uom != null) {
            scaleData.uom =
              UOM_MAP[String(scaleData.uom).toLowerCase()] ||
              scaleData.uom.toUpperCase();
          }
          if (scaleData.status != null) {
            scaleData.status =
              STATUS_MAP[String(scaleData.status).toLowerCase()] ||
              scaleData.status.toUpperCase();
          }
          // Extract productionOrderDetails from scaleAssignments
          if (
            scaleData.scaleAssignments &&
            scaleData.scaleAssignments.length > 0
          ) {
            scaleData.productionOrderDetails = scaleData.scaleAssignments
              .map((assignment) => assignment.productionOrderDetail)
              .filter((detail) => detail !== null && detail !== undefined);
          } else {
            scaleData.productionOrderDetails = [];
          }
          // Remove scaleAssignments from response as we only need productionOrderDetails
          delete scaleData.scaleAssignments;

          // Collect all productionOrderIds from productionOrderDetails
          const productionOrderIds = [
            ...new Set(
              (scaleData.productionOrderDetails || [])
                .map((detail) => detail?.productionOrderId)
                .filter((id) => id !== null && id !== undefined)
            ),
          ];

          // Fetch all ProductionOrderSAP records in one query
          const productionOrderSAPMap = new Map();
          if (productionOrderIds.length > 0) {
            const productionOrderSAPs = await ProductionOrderSAP.findAll({
              where: {
                id: { [Sequelize.Op.in]: productionOrderIds },
              },
            });

            productionOrderSAPs.forEach((sap) => {
              productionOrderSAPMap.set(sap.id, sap.toJSON());
            });
          }

          // Attach ProductionOrderSAP to each productionOrderDetail
          if (
            scaleData.productionOrderDetails &&
            scaleData.productionOrderDetails.length > 0
          ) {
            scaleData.productionOrderDetails = scaleData.productionOrderDetails
              .map((detail) => {
                if (!detail) return null;

                const productionOrderSAP = productionOrderSAPMap.get(
                  detail.productionOrderId
                );

                // Only include detail if it has productionOrderSAP with productionOrderNumber
                if (
                  productionOrderSAP &&
                  productionOrderSAP.productionOrderNumber
                ) {
                  detail.productionOrderSAP = productionOrderSAP;
                  return detail;
                }
                return null;
              })
              .filter((detail) => detail !== null && detail !== undefined);
          }

          return scaleData;
        } catch (err) {
          throw err;
        }
      }
    ),
  },

  Scale: {
    // Convert database value to GraphQL ENUM (except capacity - keep as is)
    uom: (scale) => {
      try {
        const rawValue = scale.get ? scale.get('uom') : scale.uom;
        const uomValue = String(rawValue || '').toLowerCase();
        const mappedValue = UOM_MAP[uomValue];
        return mappedValue || uomValue.toUpperCase();
      } catch (error) {
        console.error('Error in uom resolver:', error);
        return scale.uom;
      }
    },
    status: (scale) => {
      try {
        const rawValue = scale.get ? scale.get('status') : scale.status;
        const statusValue = String(rawValue || '').toLowerCase();
        const mappedValue = STATUS_MAP[statusValue];
        return mappedValue || statusValue.toUpperCase();
      } catch (error) {
        console.error('Error in status resolver:', error);
        return scale.status;
      }
    },
  },

  Mutation: {
    scaleCreate: combineResolvers(
      isAuthenticated,
      // hasPermission('scale.create'),
      async (_, { input }) => {
        validateInput(validationSchemas.scaleCreate, input);

        // Convert GraphQL ENUM to database value (capacity: use directly from database)
        if (input.uom) {
          input.uom = UOM_MAP[input.uom];
        }
        if (input.status) {
          input.status = STATUS_MAP[input.status];
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
          // Capacity: keep as is from database
          result.uom = UOM_MAP[result.uom] || result.uom;
          result.status = STATUS_MAP[result.status] || result.status;

          await transaction.commit();
          return result; // ✅ Return converted plain object
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    scaleUpdate: combineResolvers(
      isAuthenticated,
      // hasPermission('scale.update'),
      async (_, { id, input }) => {
        validateInput(validationSchemas.scaleUpdate, { id, ...input });

        // Convert GraphQL ENUM to database value (capacity: use directly from database)
        if (input.uom) {
          input.uom = UOM_MAP[input.uom];
        }
        if (input.status) {
          input.status = STATUS_MAP[input.status];
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
          // Capacity: keep as is from database
          result.uom = UOM_MAP[result.uom] || result.uom;
          result.status = STATUS_MAP[result.status] || result.status;

          await transaction.commit();
          return result;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    scaleDelete: combineResolvers(
      isAuthenticated,
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
