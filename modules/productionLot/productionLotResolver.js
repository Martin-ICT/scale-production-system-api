const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const ProductionLot = require('../../models/productionLot');
const hasPermission = require('../../middlewares/hasPermission');

const validationSchemas = {
  productionLotCreate: Joi.object({
    name: Joi.string().required(),
  }),
  productionLotUpdate: Joi.object({
    id: Joi.number().integer().required(),
    name: Joi.string().required(),
  }),
  productionLotDelete: Joi.object({
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
    productionLotList: combineResolvers(
      // hasPermission('productionLot.read'),
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
              inColumns: ['name'],
            });
          }

          if (filter?.name) {
            whereClause.name = {
              [Sequelize.Op.like]: `%${filter.name}%`,
            };
          }

          const countResult = await ProductionLot.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await ProductionLot.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
          });

          return {
            productionLots: result,
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

    productionLotDetail: combineResolvers(
      // hasPermission('productionLot.read'),
      async (_, { id }) => {
        try {
          const productionLot = await ProductionLot.findByPk(id);

          if (!productionLot) {
            throw new ApolloError(
              'Production Lot not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          return productionLot;
        } catch (err) {
          throw err;
        }
      }
    ),
  },

  Mutation: {
    productionLotCreate: combineResolvers(
      // hasPermission('productionLot.create'),
      async (_, { input }) => {
        validateInput(validationSchemas.productionLotCreate, input);

        const transaction = await ProductionLot.sequelize.transaction();

        try {
          const existingProductionLot = await ProductionLot.findOne({
            where: {
              name: input.name,
            },
          });

          if (existingProductionLot) {
            throw new ApolloError(
              'A production lot with the same name already exists',
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          const newProductionLot = await ProductionLot.create(input, {
            transaction,
          });

          await transaction.commit();
          return newProductionLot;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    productionLotUpdate: combineResolvers(
      // hasPermission('productionLot.update'),
      async (_, { id, input }) => {
        validateInput(validationSchemas.productionLotUpdate, { id, ...input });

        const transaction = await ProductionLot.sequelize.transaction();

        try {
          const productionLot = await ProductionLot.findByPk(id);
          if (!productionLot) {
            throw new ApolloError(
              'Production Lot not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          if (input.name && input.name !== productionLot.name) {
            const existingProductionLot = await ProductionLot.findOne({
              where: {
                name: input.name,
                id: { [Sequelize.Op.ne]: id },
              },
            });

            if (existingProductionLot) {
              throw new ApolloError(
                'A production lot with the same name already exists',
                apolloErrorCodes.BAD_DATA_VALIDATION
              );
            }
          }

          await productionLot.update(input, { transaction });

          await transaction.commit();
          return productionLot;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    productionLotDelete: combineResolvers(
      // hasPermission('productionLot.delete'),
      async (_, { id }) => {
        validateInput(validationSchemas.productionLotDelete, { id });

        const transaction = await ProductionLot.sequelize.transaction();

        try {
          const productionLot = await ProductionLot.findByPk(id);
          if (!productionLot) {
            throw new ApolloError(
              'Production Lot not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          await productionLot.destroy({ transaction, force: true });

          await transaction.commit();

          return productionLot;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),
  },
};

