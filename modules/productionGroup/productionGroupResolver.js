const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const ProductionGroup = require('../../models/productionGroup');
const hasPermission = require('../../middlewares/hasPermission');
const isAuthenticated = require('../../middlewares/isAuthenticated');

const validationSchemas = {
  productionGroupCreate: Joi.object({
    code: Joi.string().required(),
    name: Joi.string().required(),
  }),
  productionGroupUpdate: Joi.object({
    id: Joi.number().integer().required(),
    code: Joi.string().required(),
    name: Joi.string().required(),
  }),
  productionGroupDelete: Joi.object({
    id: Joi.number().integer().required(),
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
    productionGroupList: combineResolvers(
      isAuthenticated,
      // hasPermission('productionGroup.read'),
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
              inColumns: ['code', 'name'],
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

          const countResult = await ProductionGroup.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await ProductionGroup.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
          });

          return {
            productionGroups: result,
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

    productionGroupDetail: combineResolvers(
      isAuthenticated,
      // hasPermission('productionGroup.read'),
      async (_, { id }) => {
        try {
          const productionGroup = await ProductionGroup.findByPk(id);

          if (!productionGroup) {
            throw new ApolloError(
              'Production Group not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          return productionGroup;
        } catch (err) {
          throw err;
        }
      }
    ),
  },

  Mutation: {
    productionGroupCreate: combineResolvers(
      isAuthenticated,
      // hasPermission('productionGroup.create'),
      async (_, { input }) => {
        validateInput(validationSchemas.productionGroupCreate, input);

        const transaction = await ProductionGroup.sequelize.transaction();

        try {
          const existingProductionGroup = await ProductionGroup.findOne({
            where: {
              [Sequelize.Op.or]: [{ code: input.code }, { name: input.name }],
            },
          });

          if (existingProductionGroup) {
            throw new ApolloError(
              'A production group with the same code or name already exists',
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          const newProductionGroup = await ProductionGroup.create(input, {
            transaction,
          });

          await transaction.commit();
          return newProductionGroup;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    productionGroupUpdate: combineResolvers(
      isAuthenticated,
      // hasPermission('productionGroup.update'),
      async (_, { id, input }) => {
        validateInput(validationSchemas.productionGroupUpdate, {
          id,
          ...input,
        });

        const transaction = await ProductionGroup.sequelize.transaction();

        try {
          const productionGroup = await ProductionGroup.findByPk(id);
          if (!productionGroup) {
            throw new ApolloError(
              'Production Group not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          if (
            (input.code && input.code !== productionGroup.code) ||
            (input.name && input.name !== productionGroup.name)
          ) {
            const existingProductionGroup = await ProductionGroup.findOne({
              where: {
                [Sequelize.Op.or]: [{ code: input.code }, { name: input.name }],
                id: { [Sequelize.Op.ne]: id },
              },
            });

            if (existingProductionGroup) {
              throw new ApolloError(
                'A production group with the same code or name already exists',
                apolloErrorCodes.BAD_DATA_VALIDATION
              );
            }
          }

          await productionGroup.update(input, { transaction });

          await transaction.commit();
          return productionGroup;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    productionGroupDelete: combineResolvers(
      isAuthenticated,
      // hasPermission('productionGroup.delete'),
      async (_, { id }) => {
        validateInput(validationSchemas.productionGroupDelete, { id });

        const transaction = await ProductionGroup.sequelize.transaction();

        try {
          const productionGroup = await ProductionGroup.findByPk(id);
          if (!productionGroup) {
            throw new ApolloError(
              'Production Group not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          await productionGroup.destroy({ transaction, force: true });

          await transaction.commit();

          return productionGroup;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),
  },
};
