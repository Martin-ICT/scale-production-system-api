const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const { Sequelize } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const definedSearch = require('../../helpers/definedSearch');
const Organization = require('../../models/organization');
const isAuthenticated = require('../../middlewares/isAuthenticated');

module.exports = {
  Query: {
    plantList: combineResolvers(
      isAuthenticated,
      // hasPermission('plant.read'),
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
          let whereClause = {};

          if (search) {
            whereClause = definedSearch({
              query: search,
              inColumns: ['code', 'name', 'description'],
            });
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

          if (filter?.description) {
            whereClause.description = {
              [Sequelize.Op.like]: `%${filter.description}%`,
            };
          }

          const countResult = await Organization.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await Organization.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
          });

          return {
            plants: result,
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

    plantDetail: combineResolvers(
      isAuthenticated,
      // hasPermission('plant.read'),
      async (_, { id }) => {
        try {
          const plant = await Organization.findByPk(id);

          if (!plant) {
            throw new ApolloError(
              'Plant not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          return plant;
        } catch (err) {
          throw err;
        }
      }
    ),
  },
};
