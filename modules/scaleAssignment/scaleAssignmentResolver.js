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
const ProductionOrderSAP = require('../../models/productionOrderSAP');
const hasPermission = require('../../middlewares/hasPermission');
const isAuthenticated = require('../../middlewares/isAuthenticated');

// Mapping GraphQL ENUM <-> Database values (same as scaleResolver)
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
  scaleAssignmentCreate: Joi.object({
    scaleId: Joi.number().integer().required(),
    productionOrderDetailId: Joi.number().integer().required(),
  }),
  scaleAssignmentBatchCreate: Joi.object({
    scaleId: Joi.number().integer().required(),
    productionOrderDetailIds: Joi.array()
      .items(Joi.number().integer().required())
      .min(1)
      .required(),
  }),
  scaleAssignmentUpdate: Joi.object({
    scaleId: Joi.number().integer().optional(),
    productionOrderDetailId: Joi.number().integer().optional(),
  }),
  scaleAssignmentBatchDelete: Joi.object({
    scaleId: Joi.number().integer().required(),
    productionOrderDetailIds: Joi.array()
      .items(Joi.number().integer().required())
      .min(1)
      .required(),
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
                    model: ProductionOrderSAP,
                    as: 'productionOrderSAP',
                    required: false,
                  },
                ],
              },
            ],
          });

          // Convert enum values from database to GraphQL enum format for Scale
          const scaleAssignments = result.map((assignment) => {
            const assignmentData = assignment.toJSON();
            if (assignmentData.scale) {
              if (assignmentData.scale.uom != null) {
                assignmentData.scale.uom =
                  UOM_MAP[String(assignmentData.scale.uom).toLowerCase()] ||
                  assignmentData.scale.uom.toUpperCase();
              }
              if (assignmentData.scale.status != null) {
                assignmentData.scale.status =
                  STATUS_MAP[
                    String(assignmentData.scale.status).toLowerCase()
                  ] || assignmentData.scale.status.toUpperCase();
              }
            }
            return assignmentData;
          });

          return {
            scaleAssignments: scaleAssignments,
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
                    model: ProductionOrderSAP,
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

          // Convert enum values from database to GraphQL enum format for Scale
          const scaleAssignmentData = scaleAssignment.toJSON();
          if (scaleAssignmentData.scale) {
            if (scaleAssignmentData.scale.uom != null) {
              scaleAssignmentData.scale.uom =
                UOM_MAP[String(scaleAssignmentData.scale.uom).toLowerCase()] ||
                scaleAssignmentData.scale.uom.toUpperCase();
            }
            if (scaleAssignmentData.scale.status != null) {
              scaleAssignmentData.scale.status =
                STATUS_MAP[
                  String(scaleAssignmentData.scale.status).toLowerCase()
                ] || scaleAssignmentData.scale.status.toUpperCase();
            }
          }

          return scaleAssignmentData;
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
                    model: ProductionOrderSAP,
                    as: 'productionOrderSAP',
                    required: false,
                  },
                ],
              },
            ],
          });

          // Convert enum values from database to GraphQL enum format for Scale
          const scaleAssignments = result.map((assignment) => {
            const assignmentData = assignment.toJSON();
            if (assignmentData.scale) {
              if (assignmentData.scale.uom != null) {
                assignmentData.scale.uom =
                  UOM_MAP[String(assignmentData.scale.uom).toLowerCase()] ||
                  assignmentData.scale.uom.toUpperCase();
              }
              if (assignmentData.scale.status != null) {
                assignmentData.scale.status =
                  STATUS_MAP[
                    String(assignmentData.scale.status).toLowerCase()
                  ] || assignmentData.scale.status.toUpperCase();
              }
            }
            return assignmentData;
          });

          return {
            scaleAssignments: scaleAssignments,
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
                    model: ProductionOrderSAP,
                    as: 'productionOrderSAP',
                    required: false,
                  },
                ],
              },
            ],
          });

          // Convert enum values from database to GraphQL enum format for Scale
          const scaleAssignments = result.map((assignment) => {
            const assignmentData = assignment.toJSON();
            if (assignmentData.scale) {
              if (assignmentData.scale.uom != null) {
                assignmentData.scale.uom =
                  UOM_MAP[String(assignmentData.scale.uom).toLowerCase()] ||
                  assignmentData.scale.uom.toUpperCase();
              }
              if (assignmentData.scale.status != null) {
                assignmentData.scale.status =
                  STATUS_MAP[
                    String(assignmentData.scale.status).toLowerCase()
                  ] || assignmentData.scale.status.toUpperCase();
              }
            }
            return assignmentData;
          });

          return {
            scaleAssignments: scaleAssignments,
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
                    model: ProductionOrderSAP,
                    as: 'productionOrderSAP',
                  },
                ],
              },
            ],
          });

          // Convert enum values from database to GraphQL enum format for Scale
          const scaleAssignmentData = newScaleAssignment.toJSON();
          if (scaleAssignmentData.scale) {
            if (scaleAssignmentData.scale.uom != null) {
              scaleAssignmentData.scale.uom =
                UOM_MAP[String(scaleAssignmentData.scale.uom).toLowerCase()] ||
                scaleAssignmentData.scale.uom.toUpperCase();
            }
            if (scaleAssignmentData.scale.status != null) {
              scaleAssignmentData.scale.status =
                STATUS_MAP[
                  String(scaleAssignmentData.scale.status).toLowerCase()
                ] || scaleAssignmentData.scale.status.toUpperCase();
            }
          }

          return scaleAssignmentData;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    scaleAssignmentBatchCreate: combineResolvers(
      isAuthenticated,
      // hasPermission('scaleAssignment.create'),
      async (_, { input }, { user }) => {
        validateInput(validationSchemas.scaleAssignmentBatchCreate, input);
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

          // Remove duplicates from input array
          const uniqueProductionOrderDetailIds = [
            ...new Set(input.productionOrderDetailIds),
          ];

          // Validate all ProductionOrderDetails exist
          const productionOrderDetails = await ProductionOrderDetail.findAll({
            where: {
              id: { [Sequelize.Op.in]: uniqueProductionOrderDetailIds },
            },
          });

          if (
            productionOrderDetails.length !==
            uniqueProductionOrderDetailIds.length
          ) {
            const foundIds = productionOrderDetails.map((pod) => pod.id);
            const missingIds = uniqueProductionOrderDetailIds.filter(
              (id) => !foundIds.includes(id)
            );
            throw new ApolloError(
              `Production Order Detail(s) not found: ${missingIds.join(', ')}`,
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Check for existing assignments
          const existingAssignments = await ScaleAssignment.findAll({
            where: {
              scaleId: input.scaleId,
              productionOrderDetailId: {
                [Sequelize.Op.in]: uniqueProductionOrderDetailIds,
              },
            },
          });

          if (existingAssignments.length > 0) {
            const existingIds = existingAssignments.map(
              (ea) => ea.productionOrderDetailId
            );
            throw new ApolloError(
              `Scale assignment already exists for scale ${
                input.scaleId
              } and production order detail(s): ${existingIds.join(', ')}`,
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          // Create all assignments
          const assignmentsToCreate = uniqueProductionOrderDetailIds.map(
            (productionOrderDetailId) => ({
              scaleId: input.scaleId,
              productionOrderDetailId,
            })
          );

          const newScaleAssignments = await ScaleAssignment.bulkCreate(
            assignmentsToCreate,
            {
              transaction,
              returning: true,
            }
          );

          await transaction.commit();

          // Reload all with associations
          const scaleAssignmentIds = newScaleAssignments.map((sa) => sa.id);
          const reloadedAssignments = await ScaleAssignment.findAll({
            where: {
              id: { [Sequelize.Op.in]: scaleAssignmentIds },
            },
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
                    model: ProductionOrderSAP,
                    as: 'productionOrderSAP',
                  },
                ],
              },
            ],
          });

          // Convert enum values from database to GraphQL enum format for Scale
          const scaleAssignmentsData = reloadedAssignments.map((assignment) => {
            const assignmentData = assignment.toJSON();
            if (assignmentData.scale) {
              if (assignmentData.scale.uom != null) {
                assignmentData.scale.uom =
                  UOM_MAP[String(assignmentData.scale.uom).toLowerCase()] ||
                  assignmentData.scale.uom.toUpperCase();
              }
              if (assignmentData.scale.status != null) {
                assignmentData.scale.status =
                  STATUS_MAP[
                    String(assignmentData.scale.status).toLowerCase()
                  ] || assignmentData.scale.status.toUpperCase();
              }
            }
            return assignmentData;
          });

          return scaleAssignmentsData;
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
                    model: ProductionOrderSAP,
                    as: 'productionOrderSAP',
                  },
                ],
              },
            ],
          });

          // Convert enum values from database to GraphQL enum format for Scale
          const scaleAssignmentData = scaleAssignment.toJSON();
          if (scaleAssignmentData.scale) {
            if (scaleAssignmentData.scale.uom != null) {
              scaleAssignmentData.scale.uom =
                UOM_MAP[String(scaleAssignmentData.scale.uom).toLowerCase()] ||
                scaleAssignmentData.scale.uom.toUpperCase();
            }
            if (scaleAssignmentData.scale.status != null) {
              scaleAssignmentData.scale.status =
                STATUS_MAP[
                  String(scaleAssignmentData.scale.status).toLowerCase()
                ] || scaleAssignmentData.scale.status.toUpperCase();
            }
          }

          return scaleAssignmentData;
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

    scaleAssignmentBatchDelete: combineResolvers(
      isAuthenticated,
      // hasPermission('scaleAssignment.delete'),
      async (_, { input }) => {
        validateInput(validationSchemas.scaleAssignmentBatchDelete, input);
        const transaction = await ScaleAssignment.sequelize.transaction();

        try {
          // Validate Scale exists
          const scale = await Scale.findByPk(input.scaleId, { transaction });
          if (!scale) {
            throw new ApolloError(
              'Scale not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Validate ProductionOrderDetails exist
          const productionOrderDetails = await ProductionOrderDetail.findAll({
            where: {
              id: { [Sequelize.Op.in]: input.productionOrderDetailIds },
            },
            transaction,
          });

          if (
            productionOrderDetails.length !==
            input.productionOrderDetailIds.length
          ) {
            const foundIds = productionOrderDetails.map((detail) => detail.id);
            const missingIds = input.productionOrderDetailIds.filter(
              (id) => !foundIds.includes(id)
            );
            throw new ApolloError(
              `ProductionOrderDetail(s) not found: ${missingIds.join(', ')}`,
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Find and delete all matching ScaleAssignments
          const deletedCount = await ScaleAssignment.destroy({
            where: {
              scaleId: input.scaleId,
              productionOrderDetailId: {
                [Sequelize.Op.in]: input.productionOrderDetailIds,
              },
              deletedAt: null, // Only delete non-deleted records
            },
            transaction,
          });

          if (deletedCount === 0) {
            throw new ApolloError(
              'No Scale Assignments found to delete',
              apolloErrorCodes.NOT_FOUND
            );
          }

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
