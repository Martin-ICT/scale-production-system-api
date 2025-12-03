const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const { Sequelize } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const definedSearch = require('../../helpers/definedSearch');
const ElementValue = require('../../models/elementValue');
const MaterialOrderType = require('../../models/materialOrderType');
const hasPermission = require('../../middlewares/hasPermission');
const isAuthenticated = require('../../middlewares/isAuthenticated');

module.exports = {
  Query: {
    elementValueList: combineResolvers(
      isAuthenticated,
      // hasPermission('elementValue.read'),
      pageMinCheckAndPageSizeMax,
      async (
        _,
        {
          page = 0,
          pageSize = 10,
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
              inColumns: ['code', 'name', 'description'],
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

          const countResult = await ElementValue.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await ElementValue.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
            attributes: ['id', 'clientId', 'code', 'name', 'description'],
          });

          return {
            elementValues: result,
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

    elementValueDetail: combineResolvers(
      isAuthenticated,
      // hasPermission('elementValue.read'),
      async (_, { id }) => {
        try {
          const elementValue = await ElementValue.findOne({
            where: {
              id: id,
              clientId: 1000009, // Always filter by client ID
            },
            attributes: ['id', 'clientId', 'code', 'name', 'description'],
          });

          if (!elementValue) {
            throw new ApolloError(
              'Element Value not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          return elementValue;
        } catch (err) {
          throw err;
        }
      }
    ),

    elementValueCount: combineResolvers(
      isAuthenticated,
      // hasPermission('elementValue.read'),
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

          const count = await ElementValue.count({
            where: whereClause,
          });

          return { count };
        } catch (err) {
          throw err;
        }
      }
    ),

    elementValueByOrderType: combineResolvers(
      isAuthenticated,
      // hasPermission('elementValue.read'),
      pageMinCheckAndPageSizeMax,
      async (_, { materialId, page = 0, pageSize = 10 }) => {
        try {
          // Get all ElementValues associated with this Material through MaterialOrderType
          const materialOrderTypes = await MaterialOrderType.findAll({
            where: {
              materialId: materialId,
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
                required: true,
              },
            ],
            limit: pageSize,
            offset: page * pageSize,
          });

          // Extract ElementValues
          const elementValues = materialOrderTypes
            .map((mot) => mot.orderType)
            .filter((orderType) => orderType !== null);

          // Get total count
          const totalCount = await MaterialOrderType.count({
            where: {
              materialId: materialId,
              clientId: 1000009,
            },
            include: [
              {
                model: ElementValue,
                as: 'orderType',
                where: {
                  clientId: 1000009,
                },
                required: true,
              },
            ],
          });

          return {
            elementValues,
            meta: {
              totalItems: totalCount,
              pageSize,
              currentPage: page,
              totalPages: Math.ceil(totalCount / pageSize),
            },
          };
        } catch (err) {
          throw err;
        }
      }
    ),
  },

  // No Mutation section - ElementValue is read-only from external database
};
