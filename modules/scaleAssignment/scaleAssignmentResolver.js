const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const ScaleAssignment = require('../../models/scaleAssignment');
const Scale = require('../../models/scale');
const ProductionOrderDetail = require('../../models/productionOrderDetail');
const hasPermission = require('../../middlewares/hasPermission');
const isAuthenticated = require('../../middlewares/isAuthenticated');

const validationSchemas = {
  scaleAssignmentCreate: Joi.object({
    scaleId: Joi.number().integer().required(),
    productionOrderDetailId: Joi.number().integer().required(),
  }),
  scaleAssignmentUpdate: Joi.object({
    scaleId: Joi.number().integer().optional(),
    productionOrderDetailId: Joi.number().integer().optional(),
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
    scaleAssignmentList: combineResolvers(
      isAuthenticated,
      // hasPermission('scaleAssignment.read'),
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

          if (filter?.scaleId) {
            whereClause.scaleId = filter.scaleId;
          }

          if (filter?.productionOrderDetailId) {
            whereClause.productionOrderDetailId =
              filter.productionOrderDetailId;
          }

          const countResult = await ScaleAssignment.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await ScaleAssignment.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
            include: [
              {
                model: Scale,
                as: 'scale',
                required: false,
              },
              {
                model: ProductionOrderDetail,
                as: 'productionOrderDetail',
                required: false,
                include: [
                  {
                    model: require('../../models/productionOrderSAP'),
                    as: 'productionOrderSAP',
                    attributes: [
                      'id',
                      'productionOrderNumber',
                      'materialCode',
                      'status',
                    ],
                    required: false,
                  },
                ],
              },
            ],
          });

          return {
            scaleAssignments: result,
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

    scaleAssignmentDetail: combineResolvers(
      isAuthenticated,
      // hasPermission('scaleAssignment.read'),
      async (_, { id }) => {
        try {
          const scaleAssignment = await ScaleAssignment.findByPk(id, {
            include: [
              {
                model: Scale,
                as: 'scale',
                required: false,
              },
              {
                model: ProductionOrderDetail,
                as: 'productionOrderDetail',
                required: false,
                include: [
                  {
                    model: require('../../models/productionOrderSAP'),
                    as: 'productionOrderSAP',
                    required: false,
                  },
                ],
              },
            ],
          });

          if (!scaleAssignment) {
            throw new ApolloError(
              'ScaleAssignment not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          return scaleAssignment;
        } catch (err) {
          throw err;
        }
      }
    ),

    scaleAssignmentListByScale: combineResolvers(
      isAuthenticated,
      // hasPermission('scaleAssignment.read'),
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

          const countResult = await ScaleAssignment.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await ScaleAssignment.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
            include: [
              {
                model: Scale,
                as: 'scale',
                required: false,
              },
              {
                model: ProductionOrderDetail,
                as: 'productionOrderDetail',
                required: false,
                include: [
                  {
                    model: require('../../models/productionOrderSAP'),
                    as: 'productionOrderSAP',
                    attributes: [
                      'id',
                      'productionOrderNumber',
                      'materialCode',
                      'status',
                    ],
                    required: false,
                  },
                ],
              },
            ],
          });

          return {
            scaleAssignments: result,
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

    scaleAssignmentListByProductionOrderDetail: combineResolvers(
      isAuthenticated,
      // hasPermission('scaleAssignment.read'),
      pageMinCheckAndPageSizeMax,
      async (
        _,
        {
          productionOrderDetailId,
          page = 0,
          pageSize = 10,
          sort = { columnName: 'createdAt', sortOrder: 'DESC' },
        }
      ) => {
        try {
          const whereClause = {
            productionOrderDetailId: productionOrderDetailId,
          };

          const countResult = await ScaleAssignment.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await ScaleAssignment.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
            include: [
              {
                model: Scale,
                as: 'scale',
                required: false,
              },
              {
                model: ProductionOrderDetail,
                as: 'productionOrderDetail',
                required: false,
                include: [
                  {
                    model: require('../../models/productionOrderSAP'),
                    as: 'productionOrderSAP',
                    attributes: [
                      'id',
                      'productionOrderNumber',
                      'materialCode',
                      'status',
                    ],
                    required: false,
                  },
                ],
              },
            ],
          });

          return {
            scaleAssignments: result,
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
    scaleAssignmentCreate: combineResolvers(
      isAuthenticated,
      // hasPermission('scaleAssignment.create'),
      async (_, { input }, { user }) => {
        validateInput(validationSchemas.scaleAssignmentCreate, input);
        const transaction = await ScaleAssignment.sequelize.transaction();

        try {
          // Validate Scale exists
          const scale = await Scale.findByPk(input.scaleId);
          if (!scale) {
            throw new ApolloError(
              'Scale not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Validate ProductionOrderDetail exists
          const productionOrderDetail = await ProductionOrderDetail.findByPk(
            input.productionOrderDetailId
          );
          if (!productionOrderDetail) {
            throw new ApolloError(
              'Production Order Detail not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Check if assignment already exists
          const existingAssignment = await ScaleAssignment.findOne({
            where: {
              scaleId: input.scaleId,
              productionOrderDetailId: input.productionOrderDetailId,
            },
          });

          if (existingAssignment) {
            throw new ApolloError(
              'Scale assignment already exists for this scale and production order detail',
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          const newScaleAssignment = await ScaleAssignment.create(input, {
            transaction,
          });

          await transaction.commit();

          // Reload with associations
          await newScaleAssignment.reload({
            include: [
              {
                model: Scale,
                as: 'scale',
              },
              {
                model: ProductionOrderDetail,
                as: 'productionOrderDetail',
                include: [
                  {
                    model: require('../../models/productionOrderSAP'),
                    as: 'productionOrderSAP',
                  },
                ],
              },
            ],
          });

          return newScaleAssignment;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    scaleAssignmentUpdate: combineResolvers(
      isAuthenticated,
      // hasPermission('scaleAssignment.update'),
      async (_, { id, input }, { user }) => {
        validateInput(validationSchemas.scaleAssignmentUpdate, input);

        const transaction = await ScaleAssignment.sequelize.transaction();

        try {
          const scaleAssignment = await ScaleAssignment.findByPk(id);

          if (!scaleAssignment) {
            throw new ApolloError(
              'Scale Assignment not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Validate Scale if being updated
          if (input.scaleId) {
            const scale = await Scale.findByPk(input.scaleId);
            if (!scale) {
              throw new ApolloError(
                'Scale not found',
                apolloErrorCodes.NOT_FOUND
              );
            }
          }

          // Validate ProductionOrderDetail if being updated
          if (input.productionOrderDetailId) {
            const productionOrderDetail = await ProductionOrderDetail.findByPk(
              input.productionOrderDetailId
            );
            if (!productionOrderDetail) {
              throw new ApolloError(
                'Production Order Detail not found',
                apolloErrorCodes.NOT_FOUND
              );
            }
          }

          // Check for duplicate if both are being updated
          if (input.scaleId || input.productionOrderDetailId) {
            const finalScaleId = input.scaleId || scaleAssignment.scaleId;
            const finalProductionOrderDetailId =
              input.productionOrderDetailId ||
              scaleAssignment.productionOrderDetailId;

            const existingAssignment = await ScaleAssignment.findOne({
              where: {
                scaleId: finalScaleId,
                productionOrderDetailId: finalProductionOrderDetailId,
                id: { [Sequelize.Op.ne]: id },
              },
            });

            if (existingAssignment) {
              throw new ApolloError(
                'Scale assignment already exists for this scale and production order detail',
                apolloErrorCodes.BAD_DATA_VALIDATION
              );
            }
          }

          await scaleAssignment.update(input, { transaction });

          await transaction.commit();

          // Reload with associations
          await scaleAssignment.reload({
            include: [
              {
                model: Scale,
                as: 'scale',
              },
              {
                model: ProductionOrderDetail,
                as: 'productionOrderDetail',
                include: [
                  {
                    model: require('../../models/productionOrderSAP'),
                    as: 'productionOrderSAP',
                  },
                ],
              },
            ],
          });

          return scaleAssignment;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    scaleAssignmentDelete: combineResolvers(
      isAuthenticated,
      // hasPermission('scaleAssignment.delete'),
      async (_, { id }) => {
        const transaction = await ScaleAssignment.sequelize.transaction();

        try {
          const scaleAssignment = await ScaleAssignment.findByPk(id);

          if (!scaleAssignment) {
            throw new ApolloError(
              'Scale Assignment not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          await scaleAssignment.destroy({ transaction });

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
