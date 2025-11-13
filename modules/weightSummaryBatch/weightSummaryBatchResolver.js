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
  weightSummaryBatchFromScaleResults: Joi.object({
    productionOrderNumber: Joi.string().required(),
    sendToSAP: Joi.string()
      .valid('PENDING', 'PROCESSED', 'SENDING', 'FAILED', 'SUCCESS')
      .optional(),
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
            // Convert GraphQL enum to database value
            whereClause.sendToSAP =
              SEND_TO_SAP_MAP[filter.sendToSAP] ||
              filter.sendToSAP.toLowerCase();
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
      // hasPermission('weightSummaryBatch.create'),
      async (_, { input }, { user }) => {
        console.log('=== START weightSummaryBatchCreateFromScaleResults ===');
        console.log('STEP 1: Input validation');
        console.log('Input:', JSON.stringify(input, null, 2));

        validateInput(
          validationSchemas.weightSummaryBatchFromScaleResults,
          input
        );

        console.log('STEP 2: Starting transaction');
        const transaction = await WeightSummaryBatch.sequelize.transaction();

        try {
          // Automatically get all scaleResults with isSummarized = false
          // Filter by productionOrderNumber from input
          console.log('STEP 3: Building where clause for scaleResults');
          const whereClause = {
            isSummarized: false,
            productionOrderNumber: input.productionOrderNumber,
          };
          console.log('Where clause:', JSON.stringify(whereClause, null, 2));

          // Fetch scale results
          console.log('STEP 4: Fetching scaleResults from database');
          const scaleResults = await ScaleResults.findAll({
            where: whereClause,
            order: [['id', 'ASC']],
            transaction,
          });

          console.log(
            `STEP 4 RESULT: Found ${scaleResults.length} scaleResults for productionOrderNumber: ${input.productionOrderNumber}`
          );

          if (scaleResults.length > 0) {
            console.log(
              'Sample scaleResult:',
              JSON.stringify(scaleResults[0].toJSON(), null, 2)
            );
          }

          if (!scaleResults || scaleResults.length === 0) {
            console.log('STEP 4 ERROR: No scaleResults found');
            throw new ApolloError(
              `No scale results found with isSummarized=false for productionOrderNumber: ${input.productionOrderNumber}`,
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Group scale results by all relevant fields
          // All fields must match for results to be in the same group
          // If any field differs, it becomes a new row
          console.log('STEP 5: Grouping scaleResults by relevant fields');
          const groupedResults = {};
          scaleResults.forEach((result, index) => {
            const resultData = result.toJSON();
            console.log(
              `Processing scaleResult ${index + 1}/${
                scaleResults.length
              }, ID: ${resultData.id}`
            );

            // Create group key based on all relevant fields that must match
            // These fields determine if results should be grouped together
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
              'plantCode',
            ];

            // Build group key from all relevant fields
            const groupKey = groupKeyFields
              .map((field) => {
                const value = resultData[field];
                // Handle null/undefined values consistently
                return `${field}:${
                  value !== null && value !== undefined ? value : 'null'
                }`;
              })
              .join('|');

            if (!groupedResults[groupKey]) {
              groupedResults[groupKey] = [];
              console.log(
                `  Created new group: ${groupKey.substring(0, 100)}...`
              );
            }
            groupedResults[groupKey].push(resultData);
            console.log(
              `  Added to group. Group now has ${groupedResults[groupKey].length} items`
            );
          });

          console.log(
            `STEP 5 RESULT: Grouped into ${
              Object.keys(groupedResults).length
            } groups`
          );

          Object.entries(groupedResults).forEach(([key, items], index) => {
            console.log(
              `  Group ${index + 1}: ${
                items.length
              } items, key: ${key.substring(0, 100)}...`
            );
          });

          // Create WeightSummaryBatch and WeightSummaryBatchItem for each group
          console.log('STEP 6: Processing each group to create batches');
          const createdBatches = [];
          const batchItemsToCreate = [];
          const totalGroups = Object.keys(groupedResults).length;
          const skippedGroups = [];
          const skippedReasons = {};

          for (const [groupKey, groupResults] of Object.entries(
            groupedResults
          )) {
            const groupIndex = createdBatches.length + 1;
            console.log(
              `\n--- Processing Group ${groupIndex}/${totalGroups} ---`
            );
            console.log(`Group key: ${groupKey.substring(0, 100)}...`);

            if (groupResults.length === 0) {
              console.log('  SKIP: Group has no results');
              continue;
            }

            // Get representative values from first result in group
            const firstResult = groupResults[0];
            const materialCode = firstResult.materialCode;
            const scaleResultProductionOrderNumber =
              firstResult.productionOrderNumber;

            console.log(
              `  STEP 6.${groupIndex}.1: First result materialCode: ${materialCode}`
            );
            console.log(
              `  STEP 6.${groupIndex}.1: Group has ${groupResults.length} scaleResults`
            );
            console.log(
              `  STEP 6.${groupIndex}.1: ScaleResult productionOrderNumber: ${scaleResultProductionOrderNumber}`
            );
            console.log(
              `  STEP 6.${groupIndex}.1: Input productionOrderNumber: ${input.productionOrderNumber}`
            );

            // Find ProductionOrderDetail based on productionOrderNumber and materialCode
            // productionOrderNumber is in ProductionOrderSAP, not ProductionOrderDetail directly
            // Step 1: Find ProductionOrderSAP by productionOrderNumber
            // Step 2: Find ProductionOrderDetail by productionOrderId and materialCode
            console.log(
              `  STEP 6.${groupIndex}.2: Finding ProductionOrderDetail...`
            );
            console.log(`    Searching for materialCode: ${materialCode}`);

            const searchProductionOrderNumber =
              scaleResultProductionOrderNumber || input.productionOrderNumber;
            console.log(
              `    Using productionOrderNumber: ${searchProductionOrderNumber}`
            );

            // Step 1: Find ProductionOrderSAP by productionOrderNumber
            const productionOrderSAP = await ProductionOrderSAP.findOne({
              where: {
                productionOrderNumber: searchProductionOrderNumber,
              },
              attributes: ['id', 'productionOrderNumber', 'plantCode'],
              transaction,
            });

            if (!productionOrderSAP) {
              console.log(
                `  STEP 6.${groupIndex}.2 RESULT: ProductionOrderSAP NOT FOUND - Skipping group`
              );

              // Track skipped group
              skippedGroups.push({
                groupIndex,
                materialCode,
                productionOrderNumber: searchProductionOrderNumber,
                scaleResultCount: groupResults.length,
              });

              skippedReasons[materialCode] = {
                searchedFor: searchProductionOrderNumber,
                found: [],
                message: `ProductionOrderSAP with productionOrderNumber '${searchProductionOrderNumber}' does not exist`,
              };

              continue;
            }

            // Step 2: Find ProductionOrderDetail by productionOrderId and materialCode
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
              // Skip this group if ProductionOrderDetail not found (no error, just skip)
              console.log(
                `  STEP 6.${groupIndex}.2 RESULT: ProductionOrderDetail NOT FOUND - Skipping group`
              );

              // Track skipped group
              skippedGroups.push({
                groupIndex,
                materialCode,
                productionOrderNumber: searchProductionOrderNumber,
                productionOrderId: productionOrderSAP.id,
                scaleResultCount: groupResults.length,
              });

              skippedReasons[materialCode] = {
                searchedFor: searchProductionOrderNumber,
                found: [],
                message: `ProductionOrderDetail not found for productionOrderId ${productionOrderSAP.id} and materialCode '${materialCode}'`,
              };

              continue;
            }

            console.log(
              `  STEP 6.${groupIndex}.2 RESULT: Found ProductionOrderDetail`
            );
            console.log(
              `    ProductionOrderDetail ID: ${productionOrderDetail.id}`
            );
            console.log(`    materialCode: ${materialCode}`);
            console.log(
              `    productionOrderSAP ID: ${productionOrderDetail.productionOrderSAP?.id}`
            );
            console.log(
              `    plantCode: ${productionOrderDetail.productionOrderSAP?.plantCode}`
            );

            // Get plantCode for batchId generation
            console.log(`  STEP 6.${groupIndex}.3: Getting plantCode`);
            let plantCode =
              productionOrderDetail.productionOrderSAP?.plantCode ||
              firstResult.plantCode ||
              user?.plantCode;
            console.log(`    plantCode: ${plantCode}`);

            // Calculate totals and find min/max IDs
            console.log(`  STEP 6.${groupIndex}.4: Calculating totals and IDs`);
            const scaleResultIds = groupResults.map((r) => r.id);
            const scaleResultIdFrom = Math.min(...scaleResultIds);
            const scaleResultIdTo = Math.max(...scaleResultIds);
            console.log(`    scaleResultIdFrom: ${scaleResultIdFrom}`);
            console.log(`    scaleResultIdTo: ${scaleResultIdTo}`);

            // Calculate totalWeight and totalWeightConverted
            const totalWeight = groupResults.reduce(
              (sum, r) => sum + (parseFloat(r.weight) || 0),
              0
            );
            const totalWeightConverted = groupResults.reduce(
              (sum, r) => sum + (parseFloat(r.weight_converted) || 0),
              0
            );
            console.log(`    totalWeight: ${totalWeight}`);
            console.log(`    totalWeightConverted: ${totalWeightConverted}`);

            // Create WeightSummaryBatch
            console.log(
              `  STEP 6.${groupIndex}.5: Creating WeightSummaryBatch payload`
            );
            const batchPayload = {
              scaleResultIdFrom,
              scaleResultIdTo,
              productionOrderDetailId: productionOrderDetail.id,
              createdBy: user?.userId || null,
            };

            // Generate batchId directly using the same logic as in the model
            const pcForBatch = plantCode ?? '0000';
            batchPayload.batchId = await generateBatchIdForPlant(
              pcForBatch,
              transaction
            );
            console.log(`    Generated batchId: ${batchPayload.batchId}`);

            // Convert GraphQL enum to database value if provided
            if (input.sendToSAP) {
              batchPayload.sendToSAP =
                SEND_TO_SAP_MAP[input.sendToSAP] ||
                input.sendToSAP.toLowerCase();
            }

            console.log(
              `  STEP 6.${groupIndex}.5: Batch payload:`,
              JSON.stringify(batchPayload, null, 2)
            );

            console.log(
              `  STEP 6.${groupIndex}.6: Creating WeightSummaryBatch in database`
            );
            // Create with explicit batchId already set
            const createOptions = { transaction };
            const newBatch = await WeightSummaryBatch.create(
              batchPayload,
              createOptions
            );

            console.log(
              `  STEP 6.${groupIndex}.6 RESULT: Created WeightSummaryBatch`
            );
            console.log(`    ID: ${newBatch.id}`);
            console.log(`    batchId: ${newBatch.batchId}`);
            console.log(
              `    Full batch:`,
              JSON.stringify(newBatch.toJSON(), null, 2)
            );

            // Create WeightSummaryBatchItem
            console.log(
              `  STEP 6.${groupIndex}.7: Creating WeightSummaryBatchItem payload`
            );
            const batchItemPayload = {
              weightSummaryBatchId: newBatch.id,
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
              packingDate: firstResult.createdAt
                ? new Date(firstResult.createdAt)
                : null,
              createdBy: user?.userId || null,
            };

            console.log(
              `  STEP 6.${groupIndex}.7: BatchItem payload:`,
              JSON.stringify(batchItemPayload, null, 2)
            );

            batchItemsToCreate.push(batchItemPayload);
            createdBatches.push(newBatch);
            console.log(
              `  STEP 6.${groupIndex} COMPLETE: Added to batch creation queue\n`
            );
          }

          // Bulk create batch items
          console.log('\nSTEP 7: Bulk creating WeightSummaryBatchItems');
          console.log(
            `  Total batchItems to create: ${batchItemsToCreate.length}`
          );

          if (batchItemsToCreate.length > 0) {
            console.log('  STEP 7.1: Executing bulkCreate...');
            await WeightSummaryBatchItem.bulkCreate(batchItemsToCreate, {
              transaction,
            });
            console.log(
              `  STEP 7.1 RESULT: Created ${batchItemsToCreate.length} WeightSummaryBatchItems`
            );
          } else {
            console.warn('  STEP 7 WARNING: No batch items to create');
          }

          // Keep isSummarized = false for testing (so data can be reused)
          // In production, this should be set to true
          console.log('\nSTEP 8: Skipping isSummarized update (for testing)');
          // const allScaleResultIds = scaleResults.map((r) => r.id);
          // if (allScaleResultIds.length > 0) {
          //   await ScaleResults.update(
          //     { isSummarized: true },
          //     {
          //       where: {
          //         id: { [Sequelize.Op.in]: allScaleResultIds },
          //       },
          //       transaction,
          //     }
          //   );
          // }

          console.log('\nSTEP 9: Summary before commit');
          console.log(`  Total groups processed: ${totalGroups}`);
          console.log(
            `  Successfully created: ${createdBatches.length} WeightSummaryBatch records`
          );
          console.log(`  Skipped groups: ${skippedGroups.length}`);
          console.log(
            `  Created ${batchItemsToCreate.length} WeightSummaryBatchItem records`
          );

          if (createdBatches.length === 0) {
            console.log('STEP 9 ERROR: No batches were created');
            console.log('\n=== DETAILED ERROR ANALYSIS ===');
            console.log(`Total groups from scaleResults: ${totalGroups}`);
            console.log(`Skipped groups: ${skippedGroups.length}`);

            if (skippedGroups.length > 0) {
              console.log('\nSkipped groups details:');
              skippedGroups.forEach((skipped, idx) => {
                console.log(`  ${idx + 1}. Group ${skipped.groupIndex}:`);
                console.log(`     - materialCode: ${skipped.materialCode}`);
                console.log(
                  `     - productionOrderNumber: ${skipped.productionOrderNumber}`
                );
                console.log(
                  `     - scaleResultCount: ${skipped.scaleResultCount}`
                );
                if (skippedReasons[skipped.materialCode]) {
                  console.log(
                    `     - Reason: ${
                      skippedReasons[skipped.materialCode].message
                    }`
                  );
                }
              });
            }

            // Get unique materialCodes from scaleResults
            const uniqueMaterialCodes = [
              ...new Set(
                scaleResults.map((r) => r.toJSON().materialCode).filter(Boolean)
              ),
            ];
            console.log(
              `\nUnique materialCodes in scaleResults: ${uniqueMaterialCodes.join(
                ', '
              )}`
            );

            // Check which materialCodes exist in ProductionOrderDetail (simplified query)
            const existingMaterialCodes = await ProductionOrderDetail.findAll({
              attributes: ['materialCode'],
              distinct: true,
              col: 'materialCode',
              raw: false,
              transaction,
            });

            const existingMaterialCodeSet = new Set();
            existingMaterialCodes.forEach((pod) => {
              if (pod.materialCode) {
                existingMaterialCodeSet.add(pod.materialCode);
              }
            });

            console.log(
              `\nMaterialCodes that exist in ProductionOrderDetail: ${Array.from(
                existingMaterialCodeSet
              ).join(', ')}`
            );

            const missingMaterialCodes = uniqueMaterialCodes.filter(
              (mc) => !existingMaterialCodeSet.has(mc)
            );
            if (missingMaterialCodes.length > 0) {
              console.log(
                `\nMaterialCodes in scaleResults but NOT in ProductionOrderDetail: ${missingMaterialCodes.join(
                  ', '
                )}`
              );
            }

            console.log('=== END ERROR ANALYSIS ===\n');

            // Return empty array instead of throwing error (kalau ga ketemu ya sudah, skip saja)
            await transaction.commit();
            console.log(
              'STEP 10 RESULT: Transaction committed (no batches created)'
            );
            return [];
          }

          console.log('\nSTEP 10: Committing transaction');
          await transaction.commit();
          console.log('STEP 10 RESULT: Transaction committed successfully');

          // Reload batches with associations (outside transaction since already committed)
          console.log('\nSTEP 11: Reloading batches with associations');
          const batchIds = createdBatches.map((b) => b.id);
          console.log(`  Batch IDs to reload: ${JSON.stringify(batchIds)}`);
          let batchesData = [];

          if (batchIds.length > 0) {
            try {
              console.log(
                '  STEP 11.1: Fetching batches with ProductionOrderDetail...'
              );
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

              console.log(
                `  STEP 11.1 RESULT: Reloaded ${reloadedBatches.length} batches`
              );

              // Convert enum values from database to GraphQL enum format
              console.log('  STEP 11.2: Converting enum values...');
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
              console.log(
                `  STEP 11.2 RESULT: Converted ${batchesData.length} batches`
              );
            } catch (reloadError) {
              // If reload fails, return the created batches without associations
              console.error(
                '  STEP 11 ERROR: Error reloading batches:',
                reloadError
              );
              console.error('  Error stack:', reloadError.stack);
              console.log(
                '  STEP 11 FALLBACK: Using created batches without associations'
              );
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
          } else {
            console.log('  STEP 11 WARNING: No batch IDs to reload');
          }

          console.log('\nSTEP 12: Final result');
          console.log(`  Returning ${batchesData.length} batches`);
          console.log('=== END weightSummaryBatchCreateFromScaleResults ===\n');

          return batchesData;
        } catch (err) {
          console.error(
            '\n=== ERROR in weightSummaryBatchCreateFromScaleResults ==='
          );
          console.error('Error message:', err.message);
          console.error('Error stack:', err.stack);

          // Only rollback if transaction hasn't been committed
          if (!transaction.finished) {
            console.log('Rolling back transaction...');
            await transaction.rollback();
            console.log('Transaction rolled back');
          } else {
            console.log('Transaction already committed, cannot rollback');
          }

          console.error('=== END ERROR ===\n');
          throw err;
        }
      }
    ),
  },
};
