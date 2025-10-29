const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const { Sequelize } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const definedSearch = require('../../helpers/definedSearch');
const MaterialOrderType = require('../../models/materialOrderType');
const Material = require('../../models/material');
const ElementValue = require('../../models/elementValue');
const hasPermission = require('../../middlewares/hasPermission');

// Manually set up associations
try {
  MaterialOrderType.belongsTo(Material, {
    foreignKey: 'materialId',
    as: 'material',
  });
  MaterialOrderType.belongsTo(ElementValue, {
    foreignKey: 'orderTypeId',
    as: 'orderType',
  });
  Material.hasMany(MaterialOrderType, {
    foreignKey: 'materialId',
    as: 'materialOrderTypes',
  });
  ElementValue.hasMany(MaterialOrderType, {
    foreignKey: 'orderTypeId',
    as: 'materialOrderTypes',
  });
  console.log('✅ MaterialOrderType associations set up successfully');
} catch (error) {
  console.error('❌ Error setting up MaterialOrderType associations:', error);
}

module.exports = {
  Query: {
    materialOrderTypeList: combineResolvers(
      // hasPermission('materialOrderType.read'),
      pageMinCheckAndPageSizeMax,
      async (
        _,
        {
          page = 0,
          pageSize = 10,
          search = null,
          sort = { columnName: 'materialId', sortOrder: 'ASC' },
          filter,
        }
      ) => {
        try {
          let whereClause = {
            clientId: 1000009, // Always filter by client ID
          };

          if (search) {
            const searchClause = definedSearch({
              query: search,
              inColumns: ['materialId', 'orderTypeId'],
            });
            whereClause = { ...whereClause, ...searchClause };
          }

          if (filter?.materialId) {
            whereClause.materialId = filter.materialId;
          }

          if (filter?.orderTypeId) {
            whereClause.orderTypeId = filter.orderTypeId;
          }

          const countResult = await MaterialOrderType.count({
            where: whereClause,
            distinct: true,
            col: 'materialId',
          });

          const result = await MaterialOrderType.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
            include: [
              {
                model: Material,
                as: 'material',
                attributes: ['id', 'code', 'name', 'uomId'],
                where: {
                  clientId: 1000009,
                },
                required: false,
              },
              {
                model: ElementValue,
                as: 'orderType',
                attributes: ['id', 'code', 'name', 'description'],
                where: {
                  clientId: 1000009,
                },
                required: false,
              },
            ],
          });

          return {
            materialOrderTypes: result,
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

    materialOrderTypeDetail: combineResolvers(
      // hasPermission('materialOrderType.read'),
      async (_, { materialId, orderTypeId }) => {
        try {
          const materialOrderType = await MaterialOrderType.findOne({
            where: {
              materialId: materialId,
              orderTypeId: orderTypeId,
              clientId: 1000009, // Always filter by client ID
            },
            include: [
              {
                model: Material,
                as: 'material',
                attributes: ['id', 'code', 'name', 'uomId'],
                where: {
                  clientId: 1000009,
                },
                required: false,
              },
              {
                model: ElementValue,
                as: 'orderType',
                attributes: ['id', 'code', 'name', 'description'],
                where: {
                  clientId: 1000009,
                },
                required: false,
              },
            ],
          });

          if (!materialOrderType) {
            throw new ApolloError(
              'Material Order Type not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          return materialOrderType;
        } catch (err) {
          throw err;
        }
      }
    ),

    materialOrderTypeCount: combineResolvers(
      // hasPermission('materialOrderType.read'),
      async (_, { filter }) => {
        try {
          let whereClause = {
            clientId: 1000009, // Always filter by client ID
          };

          if (filter?.materialId) {
            whereClause.materialId = filter.materialId;
          }

          if (filter?.orderTypeId) {
            whereClause.orderTypeId = filter.orderTypeId;
          }

          const count = await MaterialOrderType.count({
            where: whereClause,
          });

          return { count };
        } catch (err) {
          throw err;
        }
      }
    ),
  },

  // No Mutation section - MaterialOrderType is read-only from external database
};
