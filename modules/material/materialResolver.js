const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const { Sequelize } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const definedSearch = require('../../helpers/definedSearch');
const Material = require('../../models/material');
const MaterialUom = require('../../models/materialUom');
const ElementValue = require('../../models/elementValue');
const hasPermission = require('../../middlewares/hasPermission');
const isAuthenticated = require('../../middlewares/isAuthenticated');
const MaterialOrderType = require('../../models/materialOrderType');

Material.belongsTo(MaterialUom, { foreignKey: 'uomId', as: 'uom' });
MaterialUom.hasMany(Material, { foreignKey: 'uomId', as: 'materials' });

Material.belongsToMany(ElementValue, {
  through: MaterialOrderType,
  foreignKey: 'materialId',
  otherKey: 'orderTypeId',
  as: 'orderTypes',
});

// Material to MaterialOrderType association
// Material.hasMany(MaterialOrderType, {
//   foreignKey: 'materialId',
//   as: 'materialOrderTypes',
// });
// MaterialOrderType.belongsTo(Material, {
//   foreignKey: 'materialId',
//   as: 'material',
// });

module.exports = {
  Query: {
    materialList: combineResolvers(
      isAuthenticated,
      // hasPermission('material.read'),
      pageMinCheckAndPageSizeMax,
      async (
        _,
        {
          page = 0,
          pageSize = 30,
          search = null,
          sort = { columnName: 'id', sortOrder: 'ASC' },
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
              inColumns: ['code', 'name'],
            });
            whereClause = { ...whereClause, ...searchClause };
          }

          if (filter?.code) {
            whereClause.code = {
              [Sequelize.Op.like]: `%${filter.code}%`,
            };
          }

          if (filter?.name) {
            whereClause.name = {
              [Sequelize.Op.like]: `%${filter.name}%`,
            };
          }

          if (filter?.uomId) {
            whereClause.uomId = filter.uomId;
          }
          if (filter?.id) {
            whereClause.id = filter.id;
          }

          // Handle orderTypeId filter
          let includeClause = [
            {
              model: MaterialUom,
              as: 'uom',
              attributes: ['id', 'code', 'name'],
              where: {
                clientId: 1000009,
              },
              required: false,
            },
          ];

          // Add orderTypes include with conditional filtering
          if (filter?.orderTypeCode) {
            includeClause.push({
              model: ElementValue,
              as: 'orderTypes',
              where: {
                code: filter.orderTypeCode,
                clientId: 1000009,
              },
              required: true, // Only show materials that have this orderType
            });
          } else {
            includeClause.push({
              model: ElementValue,
              as: 'orderTypes',
              where: {
                clientId: 1000009,
              },
              required: false, // Show all materials with their orderTypes
            });
          }

          const countResult = await Material.count({
            where: whereClause,
            distinct: true,
            col: 'm_product_id',
            include: includeClause,
          });

          // Validate sort column name
          const allowedSortColumns = ['id', 'code', 'name', 'uomId'];
          const sortColumn = allowedSortColumns.includes(sort.columnName)
            ? sort.columnName
            : 'id';

          const result = await Material.findAll({
            where: whereClause,
            order: [[sortColumn, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
            // attributes: ['id', 'code', 'name', 'uomId'],
            include: includeClause,
          });

          return {
            materials: result,
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

    materialDetail: combineResolvers(
      isAuthenticated,
      // hasPermission('material.read'),
      async (_, { id }) => {
        try {
          const material = await Material.findOne({
            where: {
              id: id,
              clientId: 1000009, // Always filter by client ID
            },
            attributes: ['id', 'code', 'name', 'uomId'],
            include: [
              {
                model: MaterialUom,
                as: 'uom',
                attributes: ['id', 'code', 'name'],
                where: {
                  clientId: 1000009,
                },
                required: false,
              },
            ],
          });

          if (!material) {
            throw new ApolloError(
              'Material not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          return material;
        } catch (err) {
          throw err;
        }
      }
    ),

    materialCount: combineResolvers(
      isAuthenticated,
      // hasPermission('material.read'),
      async (_, { filter }) => {
        try {
          let whereClause = {
            clientId: 1000009, // Always filter by client ID
          };

          if (filter?.code) {
            whereClause.code = {
              [Sequelize.Op.like]: `%${filter.code}%`,
            };
          }

          if (filter?.name) {
            whereClause.name = {
              [Sequelize.Op.like]: `%${filter.name}%`,
            };
          }

          if (filter?.uomId) {
            whereClause.uomId = filter.uomId;
          }
          if (filter?.id) {
            whereClause.id = filter.id;
          }

          // Handle orderTypeCode filter for count
          let includeClause = [];
          if (filter?.orderTypeCode) {
            includeClause.push({
              model: MaterialOrderType,
              as: 'materialOrderTypes',
              attributes: [],
              where: {
                clientId: 1000009,
              },
              include: [
                {
                  model: ElementValue,
                  as: 'orderType',
                  attributes: [],
                  where: {
                    code: filter.orderTypeCode,
                    clientId: 1000009,
                  },
                  required: true,
                },
              ],
              required: true,
            });
          }

          const count = await Material.count({
            where: whereClause,
            include: includeClause,
            distinct: true,
            col: 'm_product_id',
          });

          return { count };
        } catch (err) {
          throw err;
        }
      }
    ),
  },

  // No Mutation section - Material is read-only from external database

  // Field resolvers
  Material: {
    orderTypes: async (material) => {
      try {
        // Get ALL ElementValues associated with this Material through MaterialOrderType
        const MaterialOrderType = require('../../models/materialOrderType');

        const materialOrderTypes = await MaterialOrderType.findAll({
          where: {
            materialId: material.id,
            clientId: 1000009,
          },
          include: [
            {
              model: ElementValue,
              as: 'orderType',
              attributes: ['id', 'clientId', 'code', 'name', 'description'],
              where: {
                clientId: 1000009,
              },
              required: false,
            },
          ],
        });

        // Extract and return all orderTypes
        return materialOrderTypes
          .map((mot) => mot.orderType)
          .filter((orderType) => orderType !== null);
      } catch (error) {
        console.error('Error fetching orderTypes for Material:', error);
        return [];
      }
    },
  },
};
