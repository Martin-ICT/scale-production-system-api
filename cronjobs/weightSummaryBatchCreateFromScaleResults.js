require('dotenv').config();
const cron = require('node-cron');
const { Sequelize } = require('sequelize');
// Import models to ensure associations are registered
const models = require('../models');
const WeightSummaryBatch = models.WeightSummaryBatch;
const WeightSummaryBatchItem = models.WeightSummaryBatchItem;
const ProductionOrderDetail = models.ProductionOrderDetail;
const ProductionOrderSAP = models.ProductionOrderSAP;
const ScaleResults = models.ScaleResults;
const Material = require('../models/material');

// Local helper to generate Batch ID
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

// Main function to create batch from scale results
const createWeightSummaryBatchFromScaleResults = async () => {
  const transaction = await WeightSummaryBatch.sequelize.transaction();

  try {
    console.log('[CRON] Starting weightSummaryBatchCreateFromScaleResults...');

    const scaleResults = await ScaleResults.findAll({
      where: { isSummarized: false },
      order: [['id', 'ASC']],
      transaction,
    });

    if (!scaleResults || scaleResults.length === 0) {
      console.log('[CRON] No scale results found with isSummarized=false');
      await transaction.commit();
      return {
        success: true,
        message: 'No scale results to process',
        batchesCreated: 0,
      };
    }

    console.log(`[CRON] Found ${scaleResults.length} scale results to process`);

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

    for (const [groupKey, groupResults] of Object.entries(groupedResults)) {
      if (groupResults.length === 0) continue;

      const firstResult = groupResults[0];
      const materialCode = firstResult.materialCode;
      const searchProductionOrderNumber = firstResult.productionOrderNumber;

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
        null;

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
        const rawMeasurementType = material.measurementType;
        materialMeasurementType = rawMeasurementType
          ? String(rawMeasurementType).toLowerCase()
          : null;
        const measurementTypeValue = parseFloat(material.measurementTypeValue);

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
            createdBy: null, // System user for cronjob
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
            storageLocationTarget: firstResult.storageLocationTarget || null,
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
            updatedBy: null, // System user for cronjob
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
          storageLocationTarget: firstResult.storageLocationTarget || null,
          packingDate: firstResult.createdAt
            ? new Date(firstResult.createdAt)
            : null,
          createdBy: null, // System user for cronjob
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
      totalWeightByPODId[podId] = (totalWeightByPODId[podId] || 0) + addWeight;

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
      console.log('[CRON] No batches created');
      return {
        success: true,
        message: 'No batches created',
        batchesCreated: 0,
      };
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
      console.log(
        `[CRON] Updated ${uniqueScaleResultIds.length} scale results to isSummarized=true`
      );
    }

    // Update totalWeighed and totalWeighedGoodReceive in ProductionOrderDetail
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
                Sequelize.fn('SUM', Sequelize.col('total_weight_converted')),
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
          const goodReceiveWeightResult = await WeightSummaryBatchItem.findAll({
            where: {
              weightSummaryBatchId: {
                [Sequelize.Op.in]: goodReceiveBatchIds,
              },
            },
            attributes: [
              [
                Sequelize.fn('SUM', Sequelize.col('total_weight_converted')),
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

    console.log(`[CRON] Successfully created ${createdBatches.length} batches`);
    return {
      success: true,
      message: `Successfully processed ${createdBatches.length} batches`,
      batchesCreated: createdBatches.length,
    };
  } catch (err) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error(
      '[CRON] Error in weightSummaryBatchCreateFromScaleResults:',
      err
    );
    throw err;
  }
};

// Schedule cronjob to run every 5 minutes
// Cron expression: '*/5 * * * *' means every 5 minutes
const startCronJob = () => {
  console.log(
    '[CRON] Scheduling weightSummaryBatchCreateFromScaleResults to run every 5 minutes'
  );

  cron.schedule(
    '*/1 * * * *',
    async () => {
      try {
        await createWeightSummaryBatchFromScaleResults();
      } catch (error) {
        console.error(
          '[CRON] Error executing weightSummaryBatchCreateFromScaleResults cronjob:',
          error
        );
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Jakarta', // Adjust timezone as needed
    }
  );

  console.log(
    '[CRON] weightSummaryBatchCreateFromScaleResults cronjob started'
  );
};

module.exports = {
  startCronJob,
  createWeightSummaryBatchFromScaleResults,
};
