const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const WeightSummaryBatch = require('../../models/weightSummaryBatch');
const WeightSummaryBatchItem = require('../../models/weightSummaryBatchItem');
const ProductionOrderDetail = require('../../models/productionOrderDetail');
const ProductionOrderSAP = require('../../models/productionOrderSAP');
const ScaleResults = require('../../models/scaleResults');
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

            console.log('MASUK GILA 1');

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

            const totalWeightConverted = groupResults.reduce((sum, r) => {
              const weightConverted =
                parseFloat(r.weight_converted || r.weightConverted || 0) || 0;
              return sum + weightConverted;
            }, 0);

            const batchKey = `${materialCode}|${searchProductionOrderNumber}|${productionOrderDetail.id}`;
            let existingBatch = batchMap.get(batchKey);

            if (!existingBatch) {
              console.log('MASUK GILA 1');
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
                console.log('MASUK GILA');
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
  },
};
