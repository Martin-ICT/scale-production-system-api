const { Sequelize } = require('sequelize');
const { combineResolvers } = require('graphql-resolvers');
const isAuthenticated = require('../../middlewares/isAuthenticated');
const Material = require('../../models/material');
const ProductionOrderDetail = require('../../models/productionOrderDetail');
const ProductionOrderSAP = require('../../models/productionOrderSAP');
const WeightSummaryBatchItem = require('../../models/weightSummaryBatchItem');

const MATERIAL_CLIENT_ID = 1000009;

module.exports = {
  Query: {
    dashboardSummary: combineResolvers(isAuthenticated, async () => {
      const [totalMaterial, totalProductionOrderDetail, totalProductionSAP] =
        await Promise.all([
          Material.count({
            where: { clientId: MATERIAL_CLIENT_ID },
            distinct: true,
            col: 'm_product_id',
          }),
          ProductionOrderDetail.count({ distinct: true, col: 'id' }),
          ProductionOrderSAP.count({ distinct: true, col: 'id' }),
        ]);

      // Sum totalWeight from WeightSummaryBatchItem (DECIMAL in DB; coerce to float)
      const totalWeightRaw = await WeightSummaryBatchItem.sum('totalWeight');
      const totalWeight = totalWeightRaw ? parseFloat(totalWeightRaw) : 0;

      return {
        totalMaterial,
        totalProductionOrderDetail,
        totalProductionSAP,
        totalWeight,
      };
    }),
  },
};
