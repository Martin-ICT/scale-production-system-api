const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const Company = require('../../models/company');
const Plant = require('../../models/plant');
const hasPermission = require('../../middlewares/hasPermission');
// const { User } = require('../../models');

const validationSchemas = {
  companyCreate: Joi.object({
    code: Joi.string().required(),
    name: Joi.string().required(),
  }),
  companyUpdate: Joi.object({
    id: Joi.number().integer().required(),
    code: Joi.string().required(),
    name: Joi.string(),
  }),
  companyDelete: Joi.object({
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
    companyList: combineResolvers(
      // hasPermission('company.read'),
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
              inColumns: ['name', 'code'],
            });
          }

          if (filter?.status) {
            whereClause.status = filter.status;
          }

          const countResult = await Company.count({
            where: whereClause,
          });

          const result = await Company.findAll({
            where: whereClause,
            order: [
              [sort.columnName, sort.sortOrder],
              ['createdAt', 'DESC'],
            ],
            limit: pageSize,
            offset: page * pageSize,
            include: [
              { model: User, as: 'creator', attributes: ['id', 'username'] },
              { model: User, as: 'updater', attributes: ['id', 'username'] },
              { model: Plant, as: 'plants' },
            ],
          });

          return {
            companies: result,
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

    companyDetail: combineResolvers(
      // hasPermission('company.read'),
      async (_, { id }) => {
        try {
          const company = await Company.findByPk(id, {
            include: [
              { model: User, as: 'creator' },
              { model: User, as: 'updater' },
              { model: Plant, as: 'plants' },
            ],
          });

          if (!company) {
            throw new ApolloError(
              'Company not found',
              apolloErrorCodes.NOT_FOUND
            );
          }
          return company;
        } catch (err) {
          return err;
        }
      }
    ),
  },

  Mutation: {
    companyCreate: combineResolvers(
      // hasPermission('company.create'),
      async (_, { input }, { user }) => {
        console.log('MARTIN', user);
        validateInput(validationSchemas.companyCreate, input);

        const transaction = await Company.sequelize.transaction();

        try {
          const existingCompany = await Company.findOne({
            where: { code: input.code },
          });
          if (existingCompany) {
            throw new ApolloError(
              'Company code must be unique',
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          input.createdBy = parseInt(user.id, 10);
          input.updatedBy = parseInt(user.id, 10);
          const newCompany = await Company.create(input, { transaction });
          await transaction.commit();
          return newCompany;
        } catch (err) {
          await transaction.rollback();
          return err;
        }
      }
    ),

    companyUpdate: combineResolvers(
      hasPermission('company.update'),
      async (_, { id, input }, { user }) => {
        validateInput(validationSchemas.companyUpdate, { id, ...input });

        const transaction = await Company.sequelize.transaction();

        try {
          const company = await Company.findByPk(id);
          if (!company) {
            throw new ApolloError(
              'Company not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          const existingCompany = await Company.findOne({
            where: {
              code: input.code,
              id: { [Sequelize.Op.ne]: id },
            },
          });

          if (existingCompany) {
            throw new ApolloError(
              'Company code must be unique',
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          input.updatedBy = parseInt(user.id, 10);

          await company.update(input, { transaction });
          await transaction.commit();
          return company;
        } catch (err) {
          await transaction.rollback();
          return err;
        }
      }
    ),

    companyDelete: combineResolvers(
      hasPermission('company.delete'),
      async (_, { id }, { user }) => {
        validateInput(validationSchemas.companyDelete, { id });

        const transaction = await Company.sequelize.transaction();

        try {
          const company = await Company.findByPk(id, { transaction });
          if (!company) {
            throw new ApolloError(
              'Company not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          const associatedPlants = await Plant.findOne({
            where: { companyId: id },
          });

          if (associatedPlants) {
            throw new ApolloError(
              'Cannot delete company because it is referenced by data in the Plant table.',
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          await company.update(
            { updatedBy: user.id, deletedBy: user.id },
            { transaction }
          );

          await company.destroy({ transaction });

          await transaction.commit();

          return company;
        } catch (err) {
          await transaction.rollback();
          return err;
        }
      }
    ),
  },
};
