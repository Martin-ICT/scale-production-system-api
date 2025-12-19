require('dotenv').config();
const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize } = require('sequelize');
const axios = require('axios');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const {
  convertDateToCustomFormat,
  formatDateTimeForSAP,
} = require('../../helpers/dateConverter');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const WeightSummaryBatch = require('../../models/weightSummaryBatch');
const WeightSummaryBatchItem = require('../../models/weightSummaryBatchItem');
const WeightSummaryBatchItemLog = require('../../models/weightSummaryBatchItemLog');
const WeightSummaryBatchItemLogDetail = require('../../models/weightSummaryBatchItemLogDetail');
const ProductionOrderDetail = require('../../models/productionOrderDetail');
const ProductionOrderSAP = require('../../models/productionOrderSAP');
const ScaleResults = require('../../models/scaleResults');
const OrderType = require('../../models/orderType');
const Material = require('../../models/material');
const hasPermission = require('../../middlewares/hasPermission');
const isAuthenticated = require('../../middlewares/isAuthenticated');

// Ensure runtime association exists (in case model association registration wasn't invoked globally)
// try {
//   if (
//     !WeightSummaryBatch.associations ||
//     !WeightSummaryBatch.associations.productionOrderDetail
//   ) {
//     WeightSummaryBatch.belongsTo(ProductionOrderDetail, {
//       foreignKey: 'productionOrderDetailId',
//       as: 'productionOrderDetail',
//     });
//   }
// } catch (e) {
//   // no-op: if association already exists or registration fails, rely on global setup
// }

// Mapping GraphQL ENUM <-> Database values
const SEND_TO_SAP_MAP = {
  // GraphQL -> Database
  PENDING: 'pending',
  PROCESSED: 'processed',
  SENDING: 'sending',
  FAILED: 'failed',
  SUCCESS: 'success',
  // Database -> GraphQL
  pending: 'PENDING',
  processed: 'PROCESSED',
  sending: 'SENDING',
  failed: 'FAILED',
  success: 'SUCCESS',
};

// Local helper to generate Batch ID (mirrors logic in model)
const generateBatchIdForPlant = async (plantCode, transaction) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateString = `${year}${month}${day}`;
  const normalizedPlantCode = String(plantCode ?? '0000');
  const prefix = `SUM${normalizedPlantCode}${dateString}`;

  const lastBatch = await WeightSummaryBatch.findOne({
    where: {
      batchId: {
        [Sequelize.Op.like]: `${prefix}%`,
      },
    },
    order: [['batchId', 'DESC']],
    transaction,
  });

  let nextNumber = 1;
  if (lastBatch && lastBatch.batchId) {
    const lastBatchId = lastBatch.batchId;
    const lastNumber = parseInt(lastBatchId.substring(prefix.length));
    if (!Number.isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
};

const validationSchemas = {
  weightSummaryBatchCreate: Joi.object({
    scaleResultIdFrom: Joi.number().integer().required(),
    scaleResultIdTo: Joi.number().integer().required(),
    productionOrderDetailId: Joi.number().integer().required(),
    batchId: Joi.string().max(20).optional().allow(null, ''),
    sendToSAP: Joi.string()
      .valid('PENDING', 'PROCESSED', 'SENDING', 'FAILED', 'SUCCESS')
      .optional(),
    plantCode: Joi.string().max(10).optional().allow(null, ''),
  }),
  weightSummaryBatchUpdate: Joi.object({
    scaleResultIdFrom: Joi.number().integer().optional(),
    scaleResultIdTo: Joi.number().integer().optional(),
    productionOrderDetailId: Joi.number().integer().optional(),
    batchId: Joi.string().max(20).optional().allow(null, ''),
    sendToSAP: Joi.string()
      .valid('PENDING', 'PROCESSED', 'SENDING', 'FAILED', 'SUCCESS')
      .optional(),
  }),
  weightSummaryBatchUpdateStatus: Joi.object({
    sendToSAP: Joi.string()
      .valid('PENDING', 'PROCESSED', 'SENDING', 'FAILED', 'SUCCESS')
      .required(),
  }),
  weightSummaryBatchItemUpdate: Joi.object({
    productionOrderNumber: Joi.string().max(20).optional().allow(null, ''),
    plantCode: Joi.string().max(10).optional().allow(null, ''),
    materialCode: Joi.string().max(10).optional().allow(null, ''),
    materialUom: Joi.string().max(10).optional().allow(null, ''),
    totalWeight: Joi.number().optional().allow(null),
    totalWeightConverted: Joi.number().optional().allow(null),
    productionGroup: Joi.string().max(2).optional().allow(null, ''),
    productionShift: Joi.number().integer().optional().allow(null),
    packingGroup: Joi.string().max(10).optional().allow(null, ''),
    packingShift: Joi.number().integer().optional().allow(null),
    productionLot: Joi.string().max(10).optional().allow(null, ''),
    productionLocation: Joi.string().max(10).optional().allow(null, ''),
    storageLocation: Joi.string().max(10).optional().allow(null, ''),
    storageLocationTarget: Joi.string().max(10).optional().allow(null, ''),
    packingDate: Joi.date().optional().allow(null),
  }),
  weightSummaryBatchItemUpdateStatusMultiple: Joi.object({
    ids: Joi.array().items(Joi.number().integer().required()).min(1).required(),
    status: Joi.string()
      .valid('PENDING', 'SUCCESS', 'FAILED', 'pending', 'success', 'failed')
      .required(),
  }),
  weightSummaryBatchItemUpdateForSAP: Joi.object({
    items: Joi.array()
      .items(
        Joi.object({
          id: Joi.number().integer().required(),
          status: Joi.string()
            .valid(
              'PENDING',
              'SUCCESS',
              'FAILED',
              'pending',
              'success',
              'failed'
            )
            .required(),
          materialDocument: Joi.string().max(50).optional().allow(null, ''),
        })
      )
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
    weightSummaryBatchList: combineResolvers(
      isAuthenticated,
      // hasPermission('weightSummaryBatch.read'),
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
              inColumns: ['batchId'],
            });
          }

          if (filter?.scaleResultIdFrom) {
            whereClause.scaleResultIdFrom = filter.scaleResultIdFrom;
          }

          if (filter?.scaleResultIdTo) {
            whereClause.scaleResultIdTo = filter.scaleResultIdTo;
          }

          if (filter?.productionOrderDetailId) {
            whereClause.productionOrderDetailId =
              filter.productionOrderDetailId;
          }

          if (filter?.batchId) {
            whereClause.batchId = filter.batchId;
          }

          if (filter?.sendToSAP) {
            if (
              Array.isArray(filter.sendToSAP) &&
              filter.sendToSAP.length > 0
            ) {
              // Convert array of GraphQL enums to database values
              whereClause.sendToSAP = {
                [Sequelize.Op.in]: filter.sendToSAP.map(
                  (status) => SEND_TO_SAP_MAP[status] || status.toLowerCase()
                ),
              };
            } else if (!Array.isArray(filter.sendToSAP)) {
              // Single value (backward compatibility)
              whereClause.sendToSAP =
                SEND_TO_SAP_MAP[filter.sendToSAP] ||
                filter.sendToSAP.toLowerCase();
            }
          }

          // Handle date range filter using DateFilter
          if (filter?.date) {
            const { startDate, endDate } = filter.date;
            if (startDate && endDate) {
              const fromDate = new Date(startDate);
              fromDate.setHours(0, 0, 0, 0);
              const toDate = new Date(endDate);
              toDate.setHours(23, 59, 59, 999);
              whereClause.createdAt = {
                [Sequelize.Op.between]: [fromDate, toDate],
              };
            } else if (startDate) {
              const fromDate = new Date(startDate);
              fromDate.setHours(0, 0, 0, 0);
              whereClause.createdAt = {
                [Sequelize.Op.gte]: fromDate,
              };
            } else if (endDate) {
              const toDate = new Date(endDate);
              toDate.setHours(23, 59, 59, 999);
              whereClause.createdAt = {
                [Sequelize.Op.lte]: toDate,
              };
            }
          }

          const countResult = await WeightSummaryBatch.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await WeightSummaryBatch.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
            include: [
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
              {
                model: WeightSummaryBatchItem,
                as: 'WeightSummaryBatchItems',
                required: false,
              },
            ],
          });

          // Convert enum values from database to GraphQL enum format
          const weightSummaryBatches = result.map((batch) => {
            const batchData = batch.toJSON();
            if (batchData.sendToSAP != null) {
              batchData.sendToSAP =
                SEND_TO_SAP_MAP[String(batchData.sendToSAP).toLowerCase()] ||
                batchData.sendToSAP.toUpperCase();
            }
            // Add productionOrderNumber from nested productionOrderSAP
            if (
              batchData.productionOrderDetail?.productionOrderSAP
                ?.productionOrderNumber
            ) {
              batchData.productionOrderNumber =
                batchData.productionOrderDetail.productionOrderSAP.productionOrderNumber;
            }
            return batchData;
          });

          return {
            weightSummaryBatches: weightSummaryBatches,
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

    weightSummaryBatchDetail: combineResolvers(
      isAuthenticated,
      // hasPermission('weightSummaryBatch.read'),
      async (_, { id }) => {
        try {
          const weightSummaryBatch = await WeightSummaryBatch.findByPk(id, {
            include: [
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
              {
                model: WeightSummaryBatchItem,
                as: 'WeightSummaryBatchItems',
                required: false,
              },
            ],
          });

          if (!weightSummaryBatch) {
            throw new ApolloError(
              'Weight Summary Batch not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Convert enum values from database to GraphQL enum format
          const batchData = weightSummaryBatch.toJSON();
          if (batchData.sendToSAP != null) {
            batchData.sendToSAP =
              SEND_TO_SAP_MAP[String(batchData.sendToSAP).toLowerCase()] ||
              batchData.sendToSAP.toUpperCase();
          }
          // Add productionOrderNumber from nested productionOrderSAP
          if (
            batchData.productionOrderDetail?.productionOrderSAP
              ?.productionOrderNumber
          ) {
            batchData.productionOrderNumber =
              batchData.productionOrderDetail.productionOrderSAP.productionOrderNumber;
          }

          return batchData;
        } catch (err) {
          throw err;
        }
      }
    ),
  },

  Mutation: {
    weightSummaryBatchCreate: combineResolvers(
      isAuthenticated,
      // hasPermission('weightSummaryBatch.create'),
      async (_, { input }, { user }) => {
        validateInput(validationSchemas.weightSummaryBatchCreate, input);
        const transaction = await WeightSummaryBatch.sequelize.transaction();

        try {
          // Validate ProductionOrderDetail exists and get plantCode
          const productionOrderDetail = await ProductionOrderDetail.findByPk(
            input.productionOrderDetailId,
            {
              transaction,
              include: [
                {
                  model: ProductionOrderSAP,
                  as: 'productionOrderSAP',
                  required: false,
                  attributes: ['id', 'plantCode'],
                },
              ],
            }
          );
          if (!productionOrderDetail) {
            throw new ApolloError(
              'Production Order Detail not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Prepare payload
          const payload = {
            scaleResultIdFrom: input.scaleResultIdFrom,
            scaleResultIdTo: input.scaleResultIdTo,
            productionOrderDetailId: input.productionOrderDetailId,
            createdBy: user?.userId || null,
          };

          // Convert GraphQL enum to database value if provided
          if (input.sendToSAP) {
            payload.sendToSAP =
              SEND_TO_SAP_MAP[input.sendToSAP] || input.sendToSAP.toLowerCase();
          }

          // Generate batchId immediately (prefer explicit generation to avoid null constraint)
          if (input.batchId) {
            payload.batchId = input.batchId;
          } else {
            // Determine plantCode source
            let plantCode =
              input.plantCode ||
              productionOrderDetail.productionOrderSAP?.plantCode ||
              user?.plantCode ||
              '0000';
            payload.batchId = await generateBatchIdForPlant(
              plantCode,
              transaction
            );
          }

          const newWeightSummaryBatch = await WeightSummaryBatch.create(
            payload,
            { transaction }
          );

          await transaction.commit();

          // Reload with associations
          await newWeightSummaryBatch.reload({
            include: [
              {
                model: ProductionOrderDetail,
                as: 'productionOrderDetail',
              },
            ],
          });

          // Convert enum values from database to GraphQL enum format
          const batchData = newWeightSummaryBatch.toJSON();
          if (batchData.sendToSAP != null) {
            batchData.sendToSAP =
              SEND_TO_SAP_MAP[String(batchData.sendToSAP).toLowerCase()] ||
              batchData.sendToSAP.toUpperCase();
          }

          return batchData;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    weightSummaryBatchUpdate: combineResolvers(
      isAuthenticated,
      // hasPermission('weightSummaryBatch.update'),
      async (_, { id, input }, { user }) => {
        validateInput(validationSchemas.weightSummaryBatchUpdate, input);
        const transaction = await WeightSummaryBatch.sequelize.transaction();

        try {
          const weightSummaryBatch = await WeightSummaryBatch.findByPk(id, {
            transaction,
          });

          if (!weightSummaryBatch) {
            throw new ApolloError(
              'Weight Summary Batch not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Prepare update payload
          const updatePayload = {
            updatedBy: user?.userId || null,
          };

          if (input.scaleResultIdFrom !== undefined) {
            updatePayload.scaleResultIdFrom = input.scaleResultIdFrom;
          }

          if (input.scaleResultIdTo !== undefined) {
            updatePayload.scaleResultIdTo = input.scaleResultIdTo;
          }

          if (input.productionOrderDetailId !== undefined) {
            // Validate ProductionOrderDetail exists
            const productionOrderDetail = await ProductionOrderDetail.findByPk(
              input.productionOrderDetailId,
              { transaction }
            );
            if (!productionOrderDetail) {
              throw new ApolloError(
                'Production Order Detail not found',
                apolloErrorCodes.NOT_FOUND
              );
            }
            updatePayload.productionOrderDetailId =
              input.productionOrderDetailId;
          }

          if (input.batchId !== undefined) {
            updatePayload.batchId = input.batchId;
          }

          // Convert GraphQL enum to database value if provided
          if (input.sendToSAP !== undefined) {
            updatePayload.sendToSAP =
              SEND_TO_SAP_MAP[input.sendToSAP] || input.sendToSAP.toLowerCase();
          }

          await weightSummaryBatch.update(updatePayload, { transaction });

          await transaction.commit();

          // Reload with associations
          await weightSummaryBatch.reload({
            include: [
              {
                model: ProductionOrderDetail,
                as: 'productionOrderDetail',
              },
            ],
          });

          // Convert enum values from database to GraphQL enum format
          const batchData = weightSummaryBatch.toJSON();
          if (batchData.sendToSAP != null) {
            batchData.sendToSAP =
              SEND_TO_SAP_MAP[String(batchData.sendToSAP).toLowerCase()] ||
              batchData.sendToSAP.toUpperCase();
          }

          return batchData;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    weightSummaryBatchDelete: combineResolvers(
      isAuthenticated,
      // hasPermission('weightSummaryBatch.delete'),
      async (_, { id }) => {
        const transaction = await WeightSummaryBatch.sequelize.transaction();

        try {
          const weightSummaryBatch = await WeightSummaryBatch.findByPk(id, {
            transaction,
          });

          if (!weightSummaryBatch) {
            throw new ApolloError(
              'Weight Summary Batch not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          await weightSummaryBatch.destroy({ transaction });

          await transaction.commit();
          return true;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    weightSummaryBatchCreateFromScaleResults: combineResolvers(
      isAuthenticated,
      async (_, __, { user }) => {
        const transaction = await WeightSummaryBatch.sequelize.transaction();

        try {
          const scaleResults = await ScaleResults.findAll({
            where: { isSummarized: false },
            order: [['id', 'ASC']],
            transaction,
          });

          if (!scaleResults || scaleResults.length === 0) {
            throw new ApolloError(
              'No scale results found with isSummarized=false',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Group scale results by all relevant fields
          const groupKeyFields = [
            'productionOrderNumber',
            'materialCode',
            'productionGroup',
            'productionShift',
            'packingGroup',
            'packingShift',
            'productionLot',
            'productionLocation',
            'storageLocation',
            'storageLocationTarget',
            'plantCode',
          ];

          const groupedResults = {};
          scaleResults.forEach((result) => {
            const resultData = result.toJSON();
            const groupKey = groupKeyFields
              .map((field) => {
                const value = resultData[field];
                return `${field}:${
                  value !== null && value !== undefined ? value : 'null'
                }`;
              })
              .join('|');

            if (!groupedResults[groupKey]) {
              groupedResults[groupKey] = [];
            }
            groupedResults[groupKey].push(resultData);
          });

          const createdBatches = [];
          const batchItemsToCreate = [];
          const totalConvertedByPODId = {};
          const totalWeightByPODId = {};
          const weighingCountByPODId = {};
          const batchMap = new Map();
          const processedScaleResultIds = [];

          for (const [groupKey, groupResults] of Object.entries(
            groupedResults
          )) {
            if (groupResults.length === 0) continue;

            const firstResult = groupResults[0];
            const materialCode = firstResult.materialCode;
            const searchProductionOrderNumber =
              firstResult.productionOrderNumber;

            const productionOrderSAP = await ProductionOrderSAP.findOne({
              where: { productionOrderNumber: searchProductionOrderNumber },
              attributes: ['id', 'productionOrderNumber', 'plantCode'],
              transaction,
            });

            if (!productionOrderSAP) continue;

            const productionOrderDetail = await ProductionOrderDetail.findOne({
              where: {
                productionOrderId: productionOrderSAP.id,
                materialCode: materialCode,
              },
              include: [
                {
                  model: ProductionOrderSAP,
                  as: 'productionOrderSAP',
                  required: false,
                  attributes: ['id', 'productionOrderNumber', 'plantCode'],
                },
              ],
              transaction,
            });

            if (!productionOrderDetail) {
              continue;
            }

            // Skip if batch with sendToSAP = "PROCESSED" already exists
            const processedBatch = await WeightSummaryBatch.findOne({
              where: {
                productionOrderDetailId: productionOrderDetail.id,
                sendToSAP: 'processed',
              },
              transaction,
            });

            if (processedBatch) {
              continue;
            }

            const plantCode =
              productionOrderDetail.productionOrderSAP?.plantCode ||
              firstResult.plantCode ||
              user?.plantCode;

            const scaleResultIds = groupResults.map((r) => r.id);
            const scaleResultIdFrom = Math.min(...scaleResultIds);
            const scaleResultIdTo = Math.max(...scaleResultIds);

            const totalWeight = groupResults.reduce((sum, r) => {
              return sum + (parseFloat(r.weight) || 0);
            }, 0);

            // Fetch Material to check measurementType
            // Note: Material is in WMS database, so don't use transaction from main database
            const material = await Material.findOne({
              where: {
                code: materialCode,
                clientId: 1000009, // Default client ID
              },
              attributes: ['measurementType', 'measurementTypeValue'],
            });

            // Calculate totalWeightConverted based on measurementType and update scaleResults
            let totalWeightConverted = 0;
            let materialMeasurementType = null;

            if (material) {
              // Ensure measurementType is lowercase for enum compatibility
              const rawMeasurementType =
                material.measurementType || material.z_actual_standard;
              materialMeasurementType = rawMeasurementType
                ? String(rawMeasurementType).toLowerCase()
                : null;
              const measurementTypeValue = parseFloat(
                material.measurementTypeValue || material.z_standard_value || 0
              );

              // Update each scale result with materialMeasurementType and weightConverted
              const scaleResultUpdates = [];
              for (const result of groupResults) {
                let weightConverted = 0;

                if (materialMeasurementType === 'actual') {
                  // If actual: weightConverted = weight (same value)
                  weightConverted = parseFloat(result.weight) || 0;
                } else if (materialMeasurementType === 'standard') {
                  // If standard: weightConverted = measurementTypeValue (fixed value)
                  weightConverted = measurementTypeValue;
                } else {
                  // Fallback: use existing weightConverted if available, otherwise use weight
                  weightConverted =
                    parseFloat(
                      result.weightConverted || result.weight_converted || 0
                    ) ||
                    parseFloat(result.weight) ||
                    0;
                }

                totalWeightConverted += weightConverted;

                // Prepare update for this scale result
                // Ensure materialMeasurementType is lowercase and valid enum value
                const validMeasurementType =
                  materialMeasurementType &&
                  (materialMeasurementType.toLowerCase() === 'actual' ||
                    materialMeasurementType.toLowerCase() === 'standard')
                    ? materialMeasurementType.toLowerCase()
                    : null;

                scaleResultUpdates.push({
                  id: result.id,
                  weightConverted: weightConverted,
                  materialMeasurementType: validMeasurementType,
                });
              }

              // Bulk update scale results with materialMeasurementType and weightConverted
              if (scaleResultUpdates.length > 0) {
                await Promise.all(
                  scaleResultUpdates.map((update) =>
                    ScaleResults.update(
                      {
                        weightConverted: update.weightConverted,
                        materialMeasurementType: update.materialMeasurementType,
                      },
                      {
                        where: { id: update.id },
                        transaction,
                      }
                    )
                  )
                );
              }
            } else {
              // If material not found, use existing weightConverted or fallback to weight
              totalWeightConverted = groupResults.reduce((sum, r) => {
                const weightConverted =
                  parseFloat(r.weightConverted || r.weight_converted || 0) || 0;
                return sum + (weightConverted || parseFloat(r.weight) || 0);
              }, 0);
            }

            const batchKey = `${materialCode}|${searchProductionOrderNumber}|${productionOrderDetail.id}`;
            let existingBatch = batchMap.get(batchKey);

            if (!existingBatch) {
              const existingDbBatch = await WeightSummaryBatch.findOne({
                where: {
                  productionOrderDetailId: productionOrderDetail.id,
                  sendToSAP: 'pending',
                },
                transaction,
              });

              if (existingDbBatch) {
                existingBatch = existingDbBatch;
                batchMap.set(batchKey, existingBatch);
                if (!createdBatches.find((b) => b.id === existingBatch.id)) {
                  createdBatches.push(existingBatch);
                }
                const newScaleResultIdTo = Math.max(
                  existingBatch.scaleResultIdTo,
                  scaleResultIdTo
                );
                if (newScaleResultIdTo !== existingBatch.scaleResultIdTo) {
                  await existingBatch.update(
                    { scaleResultIdTo: newScaleResultIdTo },
                    { transaction }
                  );
                  existingBatch.scaleResultIdTo = newScaleResultIdTo;
                }
              } else {
                const batchPayload = {
                  scaleResultIdFrom,
                  scaleResultIdTo,
                  productionOrderDetailId: productionOrderDetail.id,
                  sendToSAP: 'pending',
                  createdBy: user?.userId || null,
                  batchId: await generateBatchIdForPlant(
                    plantCode ?? '0000',
                    transaction
                  ),
                };

                existingBatch = await WeightSummaryBatch.create(batchPayload, {
                  transaction,
                });

                batchMap.set(batchKey, existingBatch);
                createdBatches.push(existingBatch);
              }
            } else {
              const newScaleResultIdTo = Math.max(
                existingBatch.scaleResultIdTo,
                scaleResultIdTo
              );
              if (newScaleResultIdTo !== existingBatch.scaleResultIdTo) {
                await existingBatch.update(
                  { scaleResultIdTo: newScaleResultIdTo },
                  { transaction }
                );
                existingBatch.scaleResultIdTo = newScaleResultIdTo;
              }
            }

            let existingItem = null;
            if (existingBatch.id) {
              const existingItems = await WeightSummaryBatchItem.findAll({
                where: {
                  weightSummaryBatchId: existingBatch.id,
                  productionGroup: firstResult.productionGroup || null,
                  productionShift: firstResult.productionShift || null,
                  packingGroup: firstResult.packingGroup || null,
                  packingShift: firstResult.packingShift || null,
                  productionLot: firstResult.productionLot || null,
                  productionLocation: firstResult.productionLocation || null,
                  storageLocation: firstResult.storageLocation || null,
                  storageLocationTarget:
                    firstResult.storageLocationTarget || null,
                },
                transaction,
              });

              if (existingItems.length > 0) {
                existingItem = existingItems[0];
              }
            }

            if (existingItem) {
              const newTotalWeight =
                (parseFloat(existingItem.totalWeight) || 0) + totalWeight;
              const newTotalWeightConverted =
                (parseFloat(existingItem.totalWeightConverted) || 0) +
                totalWeightConverted;

              await existingItem.update(
                {
                  totalWeight: newTotalWeight,
                  totalWeightConverted: newTotalWeightConverted,
                  updatedBy: user?.userId || null,
                },
                { transaction }
              );
            } else {
              batchItemsToCreate.push({
                weightSummaryBatchId: existingBatch.id,
                productionOrderNumber: firstResult.productionOrderNumber || '',
                plantCode: firstResult.plantCode || plantCode || '',
                materialCode: firstResult.materialCode || '',
                materialUom: firstResult.materialUom || null,
                totalWeight: totalWeight,
                totalWeightConverted: totalWeightConverted,
                productionGroup: firstResult.productionGroup || null,
                productionShift: firstResult.productionShift || null,
                packingGroup: firstResult.packingGroup || null,
                packingShift: firstResult.packingShift || null,
                productionLot: firstResult.productionLot || null,
                productionLocation: firstResult.productionLocation || null,
                storageLocation: firstResult.storageLocation || null,
                storageLocationTarget:
                  firstResult.storageLocationTarget || null,
                packingDate: firstResult.createdAt
                  ? new Date(firstResult.createdAt)
                  : null,
                createdBy: user?.userId || null,
              });
            }

            const podId = productionOrderDetail.id;
            const addConverted = Number.isFinite(totalWeightConverted)
              ? totalWeightConverted
              : 0;
            totalConvertedByPODId[podId] =
              (totalConvertedByPODId[podId] || 0) + addConverted;

            // Track totalWeight per productionOrderDetailId
            const addWeight = Number.isFinite(totalWeight) ? totalWeight : 0;
            totalWeightByPODId[podId] =
              (totalWeightByPODId[podId] || 0) + addWeight;

            // Track weighingCount per productionOrderDetailId (count of scale results)
            const scaleResultCount = groupResults.length;
            weighingCountByPODId[podId] =
              (weighingCountByPODId[podId] || 0) + scaleResultCount;

            // Track scaleResult IDs that were processed
            groupResults.forEach((result) => {
              if (result.id) {
                processedScaleResultIds.push(result.id);
              }
            });
          }

          if (batchItemsToCreate.length > 0) {
            await WeightSummaryBatchItem.bulkCreate(batchItemsToCreate, {
              transaction,
            });

            const updates = Object.entries(totalConvertedByPODId).map(
              async ([podId, addVal]) => {
                return ProductionOrderDetail.increment('totalWeighed', {
                  by: addVal,
                  where: { id: Number(podId) },
                  transaction,
                });
              }
            );

            if (updates.length > 0) {
              await Promise.all(updates);
            }
          }

          if (createdBatches.length === 0) {
            await transaction.commit();
            return [];
          }

          await transaction.commit();

          // Update isSummarized = true for all processed scaleResults
          if (processedScaleResultIds.length > 0) {
            const uniqueScaleResultIds = [...new Set(processedScaleResultIds)];
            await ScaleResults.update(
              { isSummarized: true },
              {
                where: {
                  id: { [Sequelize.Op.in]: uniqueScaleResultIds },
                },
              }
            );
          }

          // Update totalWeighed and totalWeighedGoodReceive in ProductionOrderDetail
          // totalWeighed: count all batches (all statuses)
          // totalWeighedGoodReceive: count only batches with sendToSAP = "SENDING" or "SUCCESS"
          const affectedPODIds = Object.keys(totalWeightByPODId).map(Number);
          if (affectedPODIds.length > 0) {
            for (const podId of affectedPODIds) {
              // Get all batches for this productionOrderDetailId (for totalWeighed)
              const allBatches = await WeightSummaryBatch.findAll({
                where: { productionOrderDetailId: podId },
                attributes: ['id', 'sendToSAP'],
              });

              // Get batches with sendToSAP = "sending" or "success" (for totalWeighedGoodReceive)
              const goodReceiveBatches = allBatches.filter(
                (b) => b.sendToSAP === 'sending' || b.sendToSAP === 'success'
              );

              // Calculate totalWeighed from all batches using totalWeightConverted
              let totalWeighed = 0;
              if (allBatches.length > 0) {
                const allBatchIds = allBatches.map((b) => b.id);
                const totalWeightResult = await WeightSummaryBatchItem.findAll({
                  where: {
                    weightSummaryBatchId: { [Sequelize.Op.in]: allBatchIds },
                  },
                  attributes: [
                    [
                      Sequelize.fn(
                        'SUM',
                        Sequelize.col('total_weight_converted')
                      ),
                      'totalWeight',
                    ],
                  ],
                  raw: true,
                });

                totalWeighed = parseFloat(
                  totalWeightResult[0]?.totalWeight || 0
                );
              }

              // Calculate totalWeighedGoodReceive from SENDING and SUCCESS batches only using totalWeightConverted
              let totalWeighedGoodReceive = 0;
              if (goodReceiveBatches.length > 0) {
                const goodReceiveBatchIds = goodReceiveBatches.map((b) => b.id);
                const goodReceiveWeightResult =
                  await WeightSummaryBatchItem.findAll({
                    where: {
                      weightSummaryBatchId: {
                        [Sequelize.Op.in]: goodReceiveBatchIds,
                      },
                    },
                    attributes: [
                      [
                        Sequelize.fn(
                          'SUM',
                          Sequelize.col('total_weight_converted')
                        ),
                        'totalWeight',
                      ],
                    ],
                    raw: true,
                  });

                totalWeighedGoodReceive = parseFloat(
                  goodReceiveWeightResult[0]?.totalWeight || 0
                );
              }

              // Update ProductionOrderDetail
              const updatePayload = {
                totalWeighed: totalWeighed,
                totalWeighedGoodReceive: totalWeighedGoodReceive,
              };

              // Increment weighingCount if there are scale results processed
              if (weighingCountByPODId[podId]) {
                await ProductionOrderDetail.increment('weighingCount', {
                  by: weighingCountByPODId[podId],
                  where: { id: podId },
                });
              }

              await ProductionOrderDetail.update(updatePayload, {
                where: { id: podId },
              });
            }
          }

          const batchIds = createdBatches.map((b) => b.id);
          let batchesData = [];

          if (batchIds.length > 0) {
            try {
              const reloadedBatches = await WeightSummaryBatch.findAll({
                where: {
                  id: { [Sequelize.Op.in]: batchIds },
                },
                include: [
                  {
                    model: ProductionOrderDetail,
                    as: 'productionOrderDetail',
                  },
                ],
              });

              batchesData = reloadedBatches.map((batch) => {
                const batchData = batch.toJSON();
                if (batchData.sendToSAP != null) {
                  batchData.sendToSAP =
                    SEND_TO_SAP_MAP[
                      String(batchData.sendToSAP).toLowerCase()
                    ] || batchData.sendToSAP.toUpperCase();
                }
                return batchData;
              });
            } catch (reloadError) {
              batchesData = createdBatches.map((batch) => {
                const batchData = batch.toJSON();
                if (batchData.sendToSAP != null) {
                  batchData.sendToSAP =
                    SEND_TO_SAP_MAP[
                      String(batchData.sendToSAP).toLowerCase()
                    ] || batchData.sendToSAP.toUpperCase();
                }
                return batchData;
              });
            }
          }

          return batchesData;
        } catch (err) {
          if (!transaction.finished) {
            await transaction.rollback();
          }
          throw err;
        }
      }
    ),

    weightSummaryBatchUpdateStatus: combineResolvers(
      isAuthenticated,
      // hasPermission('weightSummaryBatch.update'),
      async (_, { id, input }, { user }) => {
        validateInput(validationSchemas.weightSummaryBatchUpdateStatus, input);
        const transaction = await WeightSummaryBatch.sequelize.transaction();

        try {
          const weightSummaryBatch = await WeightSummaryBatch.findByPk(id, {
            transaction,
          });

          if (!weightSummaryBatch) {
            throw new ApolloError(
              'Weight Summary Batch not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Prepare update payload - only update sendToSAP status
          const updatePayload = {
            updatedBy: user?.userId || null,
            sendToSAP:
              SEND_TO_SAP_MAP[input.sendToSAP] || input.sendToSAP.toLowerCase(),
          };

          await weightSummaryBatch.update(updatePayload, { transaction });

          await transaction.commit();

          // Update ProductionOrderDetail.totalWeighed and totalWeighedGoodReceive
          // after status update
          const productionOrderDetailId =
            weightSummaryBatch.productionOrderDetailId;
          if (productionOrderDetailId) {
            // Get all batches for this productionOrderDetailId (for totalWeighed)
            const allBatches = await WeightSummaryBatch.findAll({
              where: { productionOrderDetailId: productionOrderDetailId },
              attributes: ['id', 'sendToSAP'],
            });

            // Get batches with sendToSAP = "sending" or "success" (for totalWeighedGoodReceive)
            const goodReceiveBatches = allBatches.filter(
              (b) => b.sendToSAP === 'sending' || b.sendToSAP === 'success'
            );

            // Calculate totalWeighed from all batches using totalWeightConverted
            let totalWeighed = 0;
            if (allBatches.length > 0) {
              const allBatchIds = allBatches.map((b) => b.id);
              const totalWeightResult = await WeightSummaryBatchItem.findAll({
                where: {
                  weightSummaryBatchId: { [Sequelize.Op.in]: allBatchIds },
                },
                attributes: [
                  [
                    Sequelize.fn(
                      'SUM',
                      Sequelize.col('total_weight_converted')
                    ),
                    'totalWeight',
                  ],
                ],
                raw: true,
              });

              totalWeighed = parseFloat(totalWeightResult[0]?.totalWeight || 0);
            }

            // Calculate totalWeighedGoodReceive from SENDING and SUCCESS batches only using totalWeightConverted
            let totalWeighedGoodReceive = 0;
            if (goodReceiveBatches.length > 0) {
              const goodReceiveBatchIds = goodReceiveBatches.map((b) => b.id);
              const goodReceiveWeightResult =
                await WeightSummaryBatchItem.findAll({
                  where: {
                    weightSummaryBatchId: {
                      [Sequelize.Op.in]: goodReceiveBatchIds,
                    },
                  },
                  attributes: [
                    [
                      Sequelize.fn(
                        'SUM',
                        Sequelize.col('total_weight_converted')
                      ),
                      'totalWeight',
                    ],
                  ],
                  raw: true,
                });

              totalWeighedGoodReceive = parseFloat(
                goodReceiveWeightResult[0]?.totalWeight || 0
              );
            }

            // Update ProductionOrderDetail
            await ProductionOrderDetail.update(
              {
                totalWeighed: totalWeighed,
                totalWeighedGoodReceive: totalWeighedGoodReceive,
              },
              { where: { id: productionOrderDetailId } }
            );
          }

          // Reload with associations
          await weightSummaryBatch.reload({
            include: [
              {
                model: ProductionOrderDetail,
                as: 'productionOrderDetail',
              },
            ],
          });

          // Convert enum values from database to GraphQL enum format
          const batchData = weightSummaryBatch.toJSON();
          if (batchData.sendToSAP != null) {
            batchData.sendToSAP =
              SEND_TO_SAP_MAP[String(batchData.sendToSAP).toLowerCase()] ||
              batchData.sendToSAP.toUpperCase();
          }

          return batchData;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    sendWeightSummaryBatchItemToSAP: combineResolvers(
      isAuthenticated,
      // hasPermission('weightSummaryBatch.sendToSAP'),
      async (_, { id }, { user }) => {
        const transaction = await WeightSummaryBatch.sequelize.transaction();

        try {
          // Find batch with all related data
          const batch = await WeightSummaryBatch.findByPk(id, {
            transaction,
            include: [
              {
                model: ProductionOrderDetail,
                as: 'productionOrderDetail',
                required: true,
                include: [
                  {
                    model: ProductionOrderSAP,
                    as: 'productionOrderSAP',
                    required: true,
                    attributes: [
                      'id',
                      'productionOrderNumber',
                      'plantCode',
                      'orderTypeCode',
                      'productionDate',
                    ],
                  },
                  {
                    model: OrderType,
                    as: 'orderType',
                    required: false,
                    attributes: ['id', 'code', 'processType'],
                  },
                ],
              },
              {
                model: WeightSummaryBatchItem,
                as: 'WeightSummaryBatchItems',
                required: true,
              },
            ],
          });

          if (!batch) {
            throw new ApolloError(
              'Weight Summary Batch not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Check if batch is in pending or processed status
          if (batch.sendToSAP !== 'processed') {
            throw new ApolloError(
              `Batch cannot be sent to SAP. Current status: ${batch.sendToSAP}`,
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          // SAP API Configuration from environment variables
          const batchData = batch.toJSON();
          const productionOrderSAP =
            batchData.productionOrderDetail?.productionOrderSAP;

          const config = {
            url:
              process.env.SAP_API_URL ||
              'http://10.204.10.15:8000/sap/bc/zws/zfmws_write_grcpf_autotosap',
            client: process.env.SAP_CLIENT || '363',
            user: process.env.SAP_USER || 'auto_ws',
            password: process.env.SAP_PASSWORD || 'initial',
          };

          const orderType = batchData.productionOrderDetail?.orderType;

          if (!productionOrderSAP) {
            throw new ApolloError(
              'Production Order SAP not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Map batch items to SAP format
          const sapData = batchData.WeightSummaryBatchItems.map(
            (item, index) => {
              const packingDate = item.packingDate
                ? new Date(item.packingDate)
                : new Date();
              const productionDate = productionOrderSAP.productionDate
                ? new Date(productionOrderSAP.productionDate)
                : new Date();

              return {
                SAPID: item.id,
                CAUFV_AUFNR: productionOrderSAP.productionOrderNumber || '',
                CAUFV_WERKS:
                  item.plantCode || productionOrderSAP.plantCode || '',
                CAUFV_AUART: productionOrderSAP.orderTypeCode || '',
                AFRUD_ISDD: productionDate
                  .toISOString()
                  .replace('T', ' ')
                  .substring(0, 19),
                MSEG_MATNR: item.materialCode || '',
                MSEG_MENGE: parseFloat(item.totalWeight) || 0,
                MSEG_ERFME: item.materialUom || 'KG',
                MSEG_CONVMENGE: parseFloat(item.totalWeightConverted) || 0,
                MSEG_MEINS: item.materialUom || 'KG',
                MSEG_LGORT: item.storageLocation || '',
                MSEG_LGORTTO: item.storageLocationTarget || '',
                MSEG_WEMPF: user.name,
                AUSP_YMDD: item.createdAt
                  ? convertDateToCustomFormat(item.createdAt)
                  : '',
                AUSP_PRODLOC: item.productionLocation || '',
                AUSP_PRODLOT: item.productionLot || '',
                AUSP_PRODGROUP: item.productionGroup || '',
                AUSP_PACKGROUP: item.packingGroup || '',
                AUSP_PROCTYPE: orderType?.processType?.toString() || '0',
                AUSP_PACKDATE: packingDate.toISOString().split('T')[0],
                AUSP_PRODSHIFT: item.productionShift?.toString() || '',
                // AUSP_PACKSHIFT: item.packingShift?.toString() || '',
                AUSP_PACKSHIFT: item.packingShift?.toString() || '',
                AUSP_PRODLINE: '',
                AUSP_PACKLINE: '',
                //IMPORTANT UNTUK KE BUTUHAN TGL 2 JANUARY DI UBAH JADI "9" , harus nya "0"
                KEY_STATUS: '9', //ada soft delete masuk
                INSERT_TIME: formatDateTimeForSAP(),
                UPDATE_TIME: formatDateTimeForSAP(),
              };
            }
          );

          // Update batch status to SENDING
          await batch.update(
            {
              sendToSAP: 'sending',
              updatedBy: user?.userId || null,
            },
            { transaction }
          );

          await transaction.commit();

          // Send to SAP API
          try {
            const response = await axios.post(
              config.url,
              { DATA: sapData },
              {
                headers: {
                  'sap-client': config.client,
                  'sap-user': config.user,
                  'sap-password': config.password,
                  'Content-Type': 'application/json',
                },
                timeout: 30000, // 30 seconds timeout
              }
            );

            // Only proceed if response is successful (status 200-299)
            if (response.status >= 200 && response.status < 300) {
              // Update batch status to SUCCESS
              await batch.update({
                sendToSAP: 'sending',
                updatedBy: user?.userId || null,
              });

              // Update all WeightSummaryBatchItem status to success
              await WeightSummaryBatchItem.update(
                {
                  status: 'success',
                  updatedBy: user?.userId || null,
                },
                {
                  where: {
                    weightSummaryBatchId: id,
                  },
                }
              );

              // Update ProductionOrderDetail.totalWeighedGoodReceive
              const productionOrderDetailId = batch.productionOrderDetailId;
              if (productionOrderDetailId) {
                const allBatches = await WeightSummaryBatch.findAll({
                  where: { productionOrderDetailId: productionOrderDetailId },
                  attributes: ['id', 'sendToSAP'],
                });

                const goodReceiveBatches = allBatches.filter(
                  (b) => b.sendToSAP === 'sending' || b.sendToSAP === 'success'
                );

                let totalWeighedGoodReceive = 0;
                if (goodReceiveBatches.length > 0) {
                  const goodReceiveBatchIds = goodReceiveBatches.map(
                    (b) => b.id
                  );
                  const goodReceiveWeightResult =
                    await WeightSummaryBatchItem.findAll({
                      where: {
                        weightSummaryBatchId: {
                          [Sequelize.Op.in]: goodReceiveBatchIds,
                        },
                      },
                      attributes: [
                        [
                          Sequelize.fn(
                            'SUM',
                            Sequelize.col('total_weight_converted')
                          ),
                          'totalWeight',
                        ],
                      ],
                      raw: true,
                    });

                  totalWeighedGoodReceive = parseFloat(
                    goodReceiveWeightResult[0]?.totalWeight || 0
                  );
                }

                await ProductionOrderDetail.update(
                  {
                    totalWeighedGoodReceive: totalWeighedGoodReceive,
                  },
                  { where: { id: productionOrderDetailId } }
                );
              }

              // Reload batch with associations
              await batch.reload({
                include: [
                  {
                    model: ProductionOrderDetail,
                    as: 'productionOrderDetail',
                  },
                ],
              });

              const batchDataResponse = batch.toJSON();
              if (batchDataResponse.sendToSAP != null) {
                batchDataResponse.sendToSAP =
                  SEND_TO_SAP_MAP[
                    String(batchDataResponse.sendToSAP).toLowerCase()
                  ] || batchDataResponse.sendToSAP.toUpperCase();
              }

              return batchDataResponse;
            } else {
              // Update all WeightSummaryBatchItem status to failed
              await WeightSummaryBatchItem.update(
                {
                  status: 'failed',
                  updatedBy: user?.userId || null,
                },
                {
                  where: {
                    weightSummaryBatchId: id,
                  },
                }
              );

              // Response status is not successful, throw error
              throw new ApolloError(
                `SAP API returned non-success status: ${response.status}`,
                apolloErrorCodes.INTERNAL_SERVER_ERROR,
                {
                  sapResponse: response.data,
                  statusCode: response.status,
                }
              );
            }
          } catch (sapError) {
            // Update batch status to FAILED
            await batch.update({
              sendToSAP: 'failed',
              updatedBy: user?.userId || null,
            });

            // Update all WeightSummaryBatchItem status to failed
            await WeightSummaryBatchItem.update(
              {
                status: 'failed',
                updatedBy: user?.userId || null,
              },
              {
                where: {
                  weightSummaryBatchId: id,
                },
              }
            );

            const errorMessage =
              sapError.response?.data?.message ||
              sapError.message ||
              'Failed to send data to SAP';

            throw new ApolloError(
              `SAP API Error: ${errorMessage}`,
              apolloErrorCodes.INTERNAL_SERVER_ERROR,
              {
                sapResponse: sapError.response?.data,
                statusCode: sapError.response?.status,
              }
            );
          }
        } catch (err) {
          if (!transaction.finished) {
            await transaction.rollback();
          }
          throw err;
        }
      }
    ),

    weightSummaryBatchItemUpdate: combineResolvers(
      isAuthenticated,
      // hasPermission('weightSummaryBatchItem.update'),
      async (_, { id, input }, { user }) => {
        validateInput(validationSchemas.weightSummaryBatchItemUpdate, input);
        const transaction =
          await WeightSummaryBatchItem.sequelize.transaction();

        try {
          // Helper function to build group key
          const groupKeyFields = [
            'productionOrderNumber',
            'materialCode',
            'productionGroup',
            'productionShift',
            'packingGroup',
            'packingShift',
            'productionLot',
            'productionLocation',
            'storageLocation',
            'storageLocationTarget',
            'plantCode',
          ];

          const buildGroupKey = (item) => {
            return groupKeyFields
              .map((field) => {
                const value = item[field];
                return `${field}:${
                  value !== null && value !== undefined ? value : 'null'
                }`;
              })
              .join('|');
          };

          // Helper function to create log detail
          const createLogDetail = async (
            logId,
            itemId,
            beforeData,
            afterData,
            transaction
          ) => {
            await WeightSummaryBatchItemLogDetail.create(
              {
                weightSummaryBatchItemLogId: logId,
                weightSummaryBatchItemId: itemId,
                beforeData: beforeData,
                afterData: afterData,
              },
              { transaction }
            );
          };

          // Helper function to convert status for GraphQL
          const convertStatusForGraphQL = (status) => {
            const STATUS_MAP = {
              pending: 'PENDING',
              success: 'SUCCESS',
              failed: 'FAILED',
            };
            if (status == null) return null;
            return (
              STATUS_MAP[String(status).toLowerCase()] ||
              String(status).toUpperCase()
            );
          };

          // Find the batch item
          const batchItem = await WeightSummaryBatchItem.findByPk(id, {
            transaction,
            include: [
              {
                model: WeightSummaryBatch,
                as: 'weightSummaryBatch',
                required: true,
              },
            ],
          });

          if (!batchItem) {
            throw new ApolloError(
              'Weight Summary Batch Item not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Check if batch status is 'processed'
          const batch = batchItem.weightSummaryBatch;
          if (batch.sendToSAP !== 'processed') {
            throw new ApolloError(
              `Batch Item can only be updated when batch status is PROCESSED. Current status: ${batch.sendToSAP}`,
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          // Get old values before update
          const oldItem = batchItem.toJSON();
          const oldStatus = oldItem.status || 'pending';
          const oldTotalWeight = parseFloat(oldItem.totalWeight) || 0;

          // ============================================
          // MECHANISM 1: Handle status 'failed' -> createFromFailed
          // ============================================
          if (oldStatus === 'failed') {
            // Soft delete the old item
            await batchItem.destroy({ transaction });

            // Create new item with updated data
            const newItemData = {
              productionOrderNumber:
                input.productionOrderNumber !== undefined
                  ? input.productionOrderNumber
                  : oldItem.productionOrderNumber,
              plantCode:
                input.plantCode !== undefined
                  ? input.plantCode
                  : oldItem.plantCode,
              materialCode:
                input.materialCode !== undefined
                  ? input.materialCode
                  : oldItem.materialCode,
              materialUom:
                input.materialUom !== undefined
                  ? input.materialUom
                  : oldItem.materialUom,
              totalWeight:
                input.totalWeight !== undefined
                  ? input.totalWeight
                  : oldItem.totalWeight,
              totalWeightConverted:
                input.totalWeightConverted !== undefined
                  ? input.totalWeightConverted
                  : oldItem.totalWeightConverted,
              productionGroup:
                input.productionGroup !== undefined
                  ? input.productionGroup
                  : oldItem.productionGroup,
              productionShift:
                input.productionShift !== undefined
                  ? input.productionShift
                  : oldItem.productionShift,
              packingGroup:
                input.packingGroup !== undefined
                  ? input.packingGroup
                  : oldItem.packingGroup,
              packingShift:
                input.packingShift !== undefined
                  ? input.packingShift
                  : oldItem.packingShift,
              productionLot:
                input.productionLot !== undefined
                  ? input.productionLot
                  : oldItem.productionLot,
              productionLocation:
                input.productionLocation !== undefined
                  ? input.productionLocation
                  : oldItem.productionLocation,
              storageLocation:
                input.storageLocation !== undefined
                  ? input.storageLocation
                  : oldItem.storageLocation,
              storageLocationTarget:
                input.storageLocationTarget !== undefined
                  ? input.storageLocationTarget
                  : oldItem.storageLocationTarget,
              weightSummaryBatchId: batch.id,
              packingDate:
                input.packingDate !== undefined
                  ? input.packingDate
                  : oldItem.packingDate,
              status: 'pending', // New item starts with pending status
              createdBy: user?.userId || null,
            };

            const newItem = await WeightSummaryBatchItem.create(newItemData, {
              transaction,
            });

            // Create log entry for createFromFailed
            const logEntry = await WeightSummaryBatchItemLog.create(
              {
                idFrom: oldItem.id,
                idTo: newItem.id,
                operation: 'createFromFailed',
                createdBy: user?.userId || null,
              },
              { transaction }
            );

            // Create log detail for old item (beforeData = old data, afterData = null because deleted)
            await createLogDetail(
              logEntry.id,
              oldItem.id,
              oldItem,
              null,
              transaction
            );

            // Create log detail for new item (beforeData = null, afterData = new data)
            await createLogDetail(
              logEntry.id,
              newItem.id,
              null,
              newItem.toJSON(),
              transaction
            );

            // Reload new item with associations
            await newItem.reload({
              include: [
                {
                  model: WeightSummaryBatch,
                  as: 'weightSummaryBatch',
                },
              ],
              transaction,
            });

            const newItemResponse = newItem.toJSON();
            newItemResponse.status = convertStatusForGraphQL(
              newItemResponse.status
            );

            await transaction.commit();
            return newItemResponse;
          }

          // ============================================
          // MECHANISM 2 & 3: Handle split, merge, or edit
          // ============================================
          // Check if split is needed (input.totalWeight is provided and is partial)
          const inputTotalWeight =
            input.totalWeight !== undefined
              ? parseFloat(input.totalWeight)
              : null;
          const isSplit =
            inputTotalWeight !== null &&
            inputTotalWeight > 0 &&
            inputTotalWeight < oldTotalWeight;

          // Prepare update payload (merge input with old values)
          const updatePayload = {
            ...input,
            updatedBy: user?.userId || null,
          };

          // If split, update original item with reduced weight
          if (isSplit) {
            const splitWeight = inputTotalWeight;
            const remainingWeight = oldTotalWeight - splitWeight;
            const oldTotalWeightConverted =
              parseFloat(oldItem.totalWeightConverted) || 0;
            const weightRatio = splitWeight / oldTotalWeight;
            const splitTotalWeightConverted =
              oldTotalWeightConverted * weightRatio;
            const remainingTotalWeightConverted =
              oldTotalWeightConverted - splitTotalWeightConverted;

            // Update original item with remaining weight
            updatePayload.totalWeight = remainingWeight;
            updatePayload.totalWeightConverted = remainingTotalWeightConverted;

            // Create new item with split weight
            const newItemData = {
              productionOrderNumber:
                input.productionOrderNumber !== undefined
                  ? input.productionOrderNumber
                  : oldItem.productionOrderNumber,
              plantCode:
                input.plantCode !== undefined
                  ? input.plantCode
                  : oldItem.plantCode,
              materialCode:
                input.materialCode !== undefined
                  ? input.materialCode
                  : oldItem.materialCode,
              materialUom:
                input.materialUom !== undefined
                  ? input.materialUom
                  : oldItem.materialUom,
              totalWeight: splitWeight,
              totalWeightConverted: splitTotalWeightConverted,
              productionGroup:
                input.productionGroup !== undefined
                  ? input.productionGroup
                  : oldItem.productionGroup,
              productionShift:
                input.productionShift !== undefined
                  ? input.productionShift
                  : oldItem.productionShift,
              packingGroup:
                input.packingGroup !== undefined
                  ? input.packingGroup
                  : oldItem.packingGroup,
              packingShift:
                input.packingShift !== undefined
                  ? input.packingShift
                  : oldItem.packingShift,
              productionLot:
                input.productionLot !== undefined
                  ? input.productionLot
                  : oldItem.productionLot,
              productionLocation:
                input.productionLocation !== undefined
                  ? input.productionLocation
                  : oldItem.productionLocation,
              storageLocation:
                input.storageLocation !== undefined
                  ? input.storageLocation
                  : oldItem.storageLocation,
              storageLocationTarget:
                input.storageLocationTarget !== undefined
                  ? input.storageLocationTarget
                  : oldItem.storageLocationTarget,
              weightSummaryBatchId: batch.id,
              packingDate:
                input.packingDate !== undefined
                  ? input.packingDate
                  : oldItem.packingDate,
              status: oldItem.status || 'pending',
              createdBy: user?.userId || null,
            };

            const splitItem = await WeightSummaryBatchItem.create(newItemData, {
              transaction,
            });

            // Create log entry for split
            const splitLogEntry = await WeightSummaryBatchItemLog.create(
              {
                idFrom: oldItem.id,
                idTo: splitItem.id,
                operation: 'split',
                createdBy: user?.userId || null,
              },
              { transaction }
            );

            // Create log detail for original item (before and after split)
            await batchItem.update(updatePayload, { transaction });
            await batchItem.reload({ transaction });
            const updatedOriginalItem = batchItem.toJSON();

            await createLogDetail(
              splitLogEntry.id,
              oldItem.id,
              oldItem,
              updatedOriginalItem,
              transaction
            );

            // Create log detail for split item
            await createLogDetail(
              splitLogEntry.id,
              splitItem.id,
              null,
              splitItem.toJSON(),
              transaction
            );

            // Reload split item with associations
            await splitItem.reload({
              include: [
                {
                  model: WeightSummaryBatch,
                  as: 'weightSummaryBatch',
                },
              ],
              transaction,
            });

            const splitItemResponse = splitItem.toJSON();
            splitItemResponse.status = convertStatusForGraphQL(
              splitItemResponse.status
            );

            await transaction.commit();
            return splitItemResponse;
          }

          // Update the item first
          await batchItem.update(updatePayload, { transaction });
          await batchItem.reload({ transaction });
          const updatedItem = batchItem.toJSON();

          // Check for merge: find items with matching group key (only pending status)
          const updatedGroupKey = buildGroupKey(updatedItem);

          const duplicateItems = await WeightSummaryBatchItem.findAll({
            where: {
              weightSummaryBatchId: batch.id,
              id: { [Sequelize.Op.ne]: id },
              status: 'pending',
              deletedAt: null,
            },
            transaction,
          });

          // Find items with matching group key
          const matchingItems = duplicateItems.filter((item) => {
            const itemData = item.toJSON();
            const itemGroupKey = buildGroupKey(itemData);
            return itemGroupKey === updatedGroupKey;
          });

          // ============================================
          // MECHANISM 3: Merge if grouping matches
          // ============================================
          if (matchingItems.length > 0) {
            const targetItem = matchingItems[0];
            const targetItemData = targetItem.toJSON();

            // Calculate new totals (add weight from updated item to target item)
            const newTotalWeight =
              (parseFloat(targetItemData.totalWeight) || 0) +
              (parseFloat(updatedItem.totalWeight) || 0);
            const newTotalWeightConverted =
              (parseFloat(targetItemData.totalWeightConverted) || 0) +
              (parseFloat(updatedItem.totalWeightConverted) || 0);

            // Prepare merge payload - use updated values for non-numeric fields
            const mergePayload = {
              totalWeight: newTotalWeight,
              totalWeightConverted: newTotalWeightConverted,
              updatedBy: user?.userId || null,
            };

            // Update non-numeric fields from updated item
            if (input.productionOrderNumber !== undefined) {
              mergePayload.productionOrderNumber =
                updatedItem.productionOrderNumber;
            }
            if (input.plantCode !== undefined) {
              mergePayload.plantCode = updatedItem.plantCode;
            }
            if (input.materialCode !== undefined) {
              mergePayload.materialCode = updatedItem.materialCode;
            }
            if (input.materialUom !== undefined) {
              mergePayload.materialUom = updatedItem.materialUom;
            }
            if (input.productionGroup !== undefined) {
              mergePayload.productionGroup = updatedItem.productionGroup;
            }
            if (input.productionShift !== undefined) {
              mergePayload.productionShift = updatedItem.productionShift;
            }
            if (input.packingGroup !== undefined) {
              mergePayload.packingGroup = updatedItem.packingGroup;
            }
            if (input.packingShift !== undefined) {
              mergePayload.packingShift = updatedItem.packingShift;
            }
            if (input.productionLot !== undefined) {
              mergePayload.productionLot = updatedItem.productionLot;
            }
            if (input.productionLocation !== undefined) {
              mergePayload.productionLocation = updatedItem.productionLocation;
            }
            if (input.storageLocation !== undefined) {
              mergePayload.storageLocation = updatedItem.storageLocation;
            }
            if (input.storageLocationTarget !== undefined) {
              mergePayload.storageLocationTarget =
                updatedItem.storageLocationTarget;
            }
            if (input.packingDate !== undefined) {
              mergePayload.packingDate = updatedItem.packingDate;
            }

            // Update target item with merged data
            await targetItem.update(mergePayload, { transaction });

            // Soft delete the updated item
            await batchItem.destroy({ transaction });

            // Create log entry for merge
            const mergeLogEntry = await WeightSummaryBatchItemLog.create(
              {
                idFrom: oldItem.id,
                idTo: targetItem.id,
                operation: 'merge',
                createdBy: user?.userId || null,
              },
              { transaction }
            );

            // Create log detail for original item (before and after, then deleted)
            await createLogDetail(
              mergeLogEntry.id,
              oldItem.id,
              oldItem,
              updatedItem,
              transaction
            );

            // Create log detail for target item (before and after merge)
            await targetItem.reload({ transaction });
            const mergedTargetItem = targetItem.toJSON();
            await createLogDetail(
              mergeLogEntry.id,
              targetItem.id,
              targetItemData,
              mergedTargetItem,
              transaction
            );

            // Reload target item with associations
            await targetItem.reload({
              include: [
                {
                  model: WeightSummaryBatch,
                  as: 'weightSummaryBatch',
                },
              ],
              transaction,
            });

            const targetItemResponse = targetItem.toJSON();
            targetItemResponse.status = convertStatusForGraphQL(
              targetItemResponse.status
            );

            await transaction.commit();
            return targetItemResponse;
          }

          // ============================================
          // MECHANISM 4: Edit (no split, no merge)
          // ============================================
          // Create log entry for edit
          const editLogEntry = await WeightSummaryBatchItemLog.create(
            {
              idFrom: oldItem.id,
              idTo: oldItem.id, // Same item, just edited
              operation: 'edit',
              createdBy: user?.userId || null,
            },
            { transaction }
          );

          // Create log detail for edited item
          await createLogDetail(
            editLogEntry.id,
            oldItem.id,
            oldItem,
            updatedItem,
            transaction
          );

          // Reload with associations
          await batchItem.reload({
            include: [
              {
                model: WeightSummaryBatch,
                as: 'weightSummaryBatch',
              },
            ],
            transaction,
          });

          const batchItemResponse = batchItem.toJSON();
          batchItemResponse.status = convertStatusForGraphQL(
            batchItemResponse.status
          );

          await transaction.commit();
          return batchItemResponse;
        } catch (err) {
          if (!transaction.finished) {
            await transaction.rollback();
          }
          throw err;
        }
      }
    ),

    weightSummaryBatchItemUpdateForSAP: combineResolvers(
      // isAuthenticated,
      // hasPermission('weightSummaryBatchItem.update'),
      async (_, { items }, { user }) => {
        validateInput(validationSchemas.weightSummaryBatchItemUpdateForSAP, {
          items,
        });
        const transaction =
          await WeightSummaryBatchItem.sequelize.transaction();

        try {
          // Convert GraphQL enum to database value
          const statusMap = {
            PENDING: 'pending',
            SUCCESS: 'success',
            FAILED: 'failed',
            pending: 'pending',
            success: 'success',
            failed: 'failed',
          };

          // Extract IDs from items array
          const ids = items.map((item) => Number(item.id));

          // Find all items by IDs
          const batchItems = await WeightSummaryBatchItem.findAll({
            where: {
              id: { [Sequelize.Op.in]: ids },
              deletedAt: null,
            },
            transaction,
          });

          if (batchItems.length === 0) {
            throw new ApolloError(
              'No Weight Summary Batch Items found with provided IDs',
              apolloErrorCodes.NOT_FOUND
            );
          }

          if (batchItems.length !== ids.length) {
            const foundIds = batchItems.map((item) => item.id);
            const notFoundIds = ids.filter(
              (id) => !foundIds.includes(Number(id))
            );
            throw new ApolloError(
              `Some Weight Summary Batch Items not found. IDs: ${notFoundIds.join(
                ', '
              )}`,
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Get unique batch IDs from items that will be updated
          const uniqueBatchIds = [
            ...new Set(
              batchItems
                .map((item) => item.weightSummaryBatchId)
                .filter(Boolean)
            ),
          ];

          // Update each item individually with its specific status and Matdoc
          const updatePromises = items.map(async (item) => {
            const itemId = Number(item.id);
            const dbStatus =
              statusMap[item.status] || item.status.toLowerCase();

            // Validate status
            if (!['pending', 'success', 'failed'].includes(dbStatus)) {
              throw new ApolloError(
                `Invalid status: ${item.status}. Must be one of: PENDING, SUCCESS, FAILED`,
                apolloErrorCodes.BAD_DATA_VALIDATION
              );
            }

            const updatePayload = {
              status: dbStatus,
              updatedBy: user?.userId || null,
            };

            // Add materialDocument if Matdoc is provided
            if (
              item.materialDocument !== undefined &&
              item.materialDocument !== null
            ) {
              updatePayload.materialDocument = item.materialDocument;
            }

            return WeightSummaryBatchItem.update(updatePayload, {
              where: { id: itemId },
              transaction,
            });
          });

          await Promise.all(updatePromises);

          // Update batch status based on items status
          // If all items are SUCCESS, batch becomes SUCCESS
          // If any item is FAILED, batch becomes PROCESSED
          if (uniqueBatchIds.length > 0) {
            for (const batchId of uniqueBatchIds) {
              // Get all items in this batch
              const allBatchItems = await WeightSummaryBatchItem.findAll({
                where: {
                  weightSummaryBatchId: batchId,
                  deletedAt: null,
                },
                attributes: ['id', 'status'],
                transaction,
              });

              // Check if all items are success
              const allSuccess = allBatchItems.every(
                (item) => item.status === 'success'
              );

              // Check if any item is failed
              const hasFailed = allBatchItems.some(
                (item) => item.status === 'failed'
              );

              let batchStatus;
              if (allSuccess) {
                // All items are success, batch becomes SUCCESS
                batchStatus = 'success';
              } else if (hasFailed) {
                // At least one item is failed, batch becomes PROCESSED
                batchStatus = 'processed';
              } else {
                // Some items might still be pending, keep as PROCESSED
                batchStatus = 'processed';
              }

              await WeightSummaryBatch.update(
                {
                  sendToSAP: batchStatus,
                  updatedBy: user?.userId || null,
                },
                {
                  where: { id: batchId },
                  transaction,
                }
              );
            }
          }

          await transaction.commit();

          // Reload all items with associations
          const updatedItems = await WeightSummaryBatchItem.findAll({
            where: {
              id: { [Sequelize.Op.in]: ids },
            },
            include: [
              {
                model: WeightSummaryBatch,
                as: 'weightSummaryBatch',
              },
            ],
          });

          // Convert status from database to GraphQL enum format
          const STATUS_MAP = {
            pending: 'PENDING',
            success: 'SUCCESS',
            failed: 'FAILED',
          };

          return updatedItems.map((item) => {
            const itemData = item.toJSON();
            if (itemData.status != null) {
              itemData.status =
                STATUS_MAP[String(itemData.status).toLowerCase()] ||
                itemData.status.toUpperCase();
            }
            return itemData;
          });
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),
  },
};
