const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize, where } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const Plant = require('../../models/plant');
const Company = require('../../models/company');
const hasPermission = require('../../middlewares/hasPermission');

const validationSchemas = {
  plantCreate: Joi.object({
    code: Joi.string().required(),
    name: Joi.string().required(),
    address: Joi.string().required(),
    companyId: Joi.number().integer().required(), // Ensure companyId is provided
  }),
  plantUpdate: Joi.object({
    id: Joi.number().integer().required(),
    code: Joi.string().required(),
    name: Joi.string(),
    address: Joi.string(),
    companyId: Joi.number().integer().required(),
  }),
  plantDelete: Joi.object({
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
    plantList: combineResolvers(
      // hasPermission('plant.read'),
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
          let whereClauseUser = {};

          if (search) {
            whereClause = definedSearch({
              query: search,
              inColumns: ['name', 'code'],
            });
          }

          if (filter?.companyId) {
            whereClause.companyId = filter.companyId;
          }
          if (filter?.userId) {
            whereClauseUser.id = filter.userId;
          }

          const includes = [
            {
              model: Company,
              as: 'company',
            },
            {
              model: Location,
              as: 'locations',
              include: [
                {
                  model: Plant,
                  as: 'plant',
                },
                {
                  model: Room,
                  as: 'rooms',
                  required: !!filter?.userId,
                  include: [
                    {
                      model: User,
                      as: 'users',
                      required: !!filter?.userId,
                      where: whereClauseUser,
                    },
                  ],
                },
              ],
            },
            { model: User, as: 'creator', attributes: ['id', 'username'] },
            { model: User, as: 'updater', attributes: ['id', 'username'] },
          ];

          const countResult = await Plant.count({
            where: whereClause,
            include: includes,
            distinct: true,
            col: 'id',
          });

          const result = await Plant.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
            include: includes,
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
          return err;
        }
      }
    ),

    plantDetail: combineResolvers(
      // hasPermission('plant.read'),
      async (_, { id }) => {
        try {
          const plant = await Plant.findByPk(id, {
            include: [
              { model: Company, as: 'company' },
              {
                model: Location,
                as: 'locations',
              },
            ],
          });

          if (!plant) {
            throw new ApolloError(
              'Plant not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          return plant;
        } catch (err) {
          return err;
        }
      }
    ),
  },

  Mutation: {
    plantCreate: combineResolvers(
      // hasPermission('plant.create'),
      async (_, { input }, { user }) => {
        validateInput(validationSchemas.plantCreate, input);
        const transaction = await Plant.sequelize.transaction();

        try {
          const existingPlant = await Plant.findOne({
            where: {
              code: input.code,
              companyId: input.companyId, // Ensure uniqueness within the same company
            },
          });

          if (existingPlant) {
            throw new ApolloError(
              'A plant with the same code already exists for this company',
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          input.createdBy = parseInt(user.id, 10);
          input.updatedBy = parseInt(user.id, 10);
          const newPlant = await Plant.create(input, { transaction });
          await transaction.commit();
          return newPlant;
        } catch (err) {
          await transaction.rollback();
          return err;
        }
      }
    ),

    plantUpdate: combineResolvers(
      // hasPermission('plant.update'),
      async (_, { id, input }, { user }) => {
        validateInput(validationSchemas.plantUpdate, { id, ...input });

        const transaction = await Plant.sequelize.transaction();

        try {
          const plant = await Plant.findByPk(id);
          if (!plant) {
            throw new ApolloError(
              'Plant not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          const existingPlant = await Plant.findOne({
            where: {
              code: input.code,
              companyId: input.companyId, // Ensure uniqueness within the same company
              id: { [Sequelize.Op.ne]: id },
            },
          });

          if (existingPlant) {
            throw new ApolloError(
              'A plant with the same code already exists for this company',
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          input.updatedBy = parseInt(user.id, 10);

          await plant.update(input, { transaction });
          await transaction.commit();
          return plant;
        } catch (err) {
          await transaction.rollback();
          return err;
        }
      }
    ),

    plantDelete: combineResolvers(
      // hasPermission('plant.delete'),
      async (_, { id }, { user }) => {
        validateInput(validationSchemas.plantDelete, { id });

        const transaction = await Plant.sequelize.transaction();

        try {
          const plant = await Plant.findByPk(id);
          if (!plant) {
            throw new ApolloError(
              'Plant not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          await plant.update(
            { updatedBy: user.id, deletedBy: user.id },
            { transaction }
          );

          await plant.destroy({ transaction, force: true });

          await transaction.commit();

          return plant;
        } catch (err) {
          await transaction.rollback();
          return err;
        }
      }
    ),
  },
};
