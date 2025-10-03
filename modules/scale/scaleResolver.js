const { ApolloError } = require('apollo-server');
const Joi = require('joi');
const { Op } = require('sequelize');
const Scale = require('../../models/scale');

const validationSchemas = {
  scaleCreate: Joi.object({
    name: Joi.string().required().min(1).max(255),
    description: Joi.string().allow('').max(1000),
  }),
  scaleUpdate: Joi.object({
    name: Joi.string().min(1).max(255),
    description: Joi.string().allow('').max(1000),
  }),
  scaleDelete: Joi.object({
    id: Joi.number().integer().required(),
  }),
};

const validateInput = (schema, data) => {
  const { error } = schema.validate(data, {
    convert: true,
    abortEarly: false,
    allowUnknown: true,
  });
  if (error) {
    throw new ApolloError(
      `Validation error: ${error.details.map((d) => d.message).join(', ')}`,
      'VALIDATION_ERROR'
    );
  }
};

const definedSearch = (options) => {
  const { query, inColumns } = options;
  if (!query || !inColumns) return {};

  return {
    [Op.or]: inColumns.map((column) => ({
      [column]: {
        [Op.like]: `%${query}%`,
      },
    })),
  };
};

module.exports = {
  Query: {
    scaleCount: async (_, { search = null }) => {
      try {
        let whereClause = {};

        if (search) {
          whereClause = definedSearch({
            query: search,
            inColumns: ['name', 'description'],
          });
        }

        const count = await Scale.count({
          where: whereClause,
        });

        return { count };
      } catch (err) {
        console.error('Error in scaleCount:', err);
        throw new ApolloError('Failed to get scale count', 'INTERNAL_ERROR');
      }
    },

    scaleList: async (
      _,
      {
        page = 0,
        pageSize = 10,
        search = null,
        sort = { columnName: 'createdAt', sortOrder: 'DESC' },
      }
    ) => {
      try {
        let whereClause = {};

        if (search) {
          whereClause = definedSearch({
            query: search,
            inColumns: ['name', 'description'],
          });
        }

        const countResult = await Scale.count({
          where: whereClause,
        });

        const result = await Scale.findAll({
          where: whereClause,
          order: [
            [sort.columnName, sort.sortOrder],
            ['createdAt', 'DESC'],
          ],
          limit: pageSize,
          offset: page * pageSize,
        });

        return {
          scales: result,
          meta: {
            totalItems: countResult,
            pageSize,
            currentPage: page,
            totalPages: Math.ceil(countResult / pageSize),
          },
        };
      } catch (err) {
        console.error('Error in scaleList:', err);
        throw new ApolloError('Failed to get scale list', 'INTERNAL_ERROR');
      }
    },

    scaleDetail: async (_, { id }) => {
      try {
        const scale = await Scale.findByPk(id);

        if (!scale) {
          throw new ApolloError('Scale not found', 'NOT_FOUND');
        }

        return scale;
      } catch (err) {
        console.error('Error in scaleDetail:', err);
        if (err instanceof ApolloError) throw err;
        throw new ApolloError('Failed to get scale detail', 'INTERNAL_ERROR');
      }
    },
  },

  Mutation: {
    scaleCreate: async (_, { input }) => {
      try {
        validateInput(validationSchemas.scaleCreate, input);

        const newScale = await Scale.create(input);
        return newScale;
      } catch (err) {
        console.error('Error in scaleCreate:', err);
        if (err instanceof ApolloError) throw err;
        throw new ApolloError('Failed to create scale', 'INTERNAL_ERROR');
      }
    },

    scaleUpdate: async (_, { id, input }) => {
      try {
        validateInput(validationSchemas.scaleUpdate, input);

        const scale = await Scale.findByPk(id);
        if (!scale) {
          throw new ApolloError('Scale not found', 'NOT_FOUND');
        }

        await scale.update(input);
        return scale;
      } catch (err) {
        console.error('Error in scaleUpdate:', err);
        if (err instanceof ApolloError) throw err;
        throw new ApolloError('Failed to update scale', 'INTERNAL_ERROR');
      }
    },

    scaleDelete: async (_, { id }) => {
      try {
        validateInput(validationSchemas.scaleDelete, { id });

        const scale = await Scale.findByPk(id);
        if (!scale) {
          throw new ApolloError('Scale not found', 'NOT_FOUND');
        }

        await scale.destroy();
        return scale;
      } catch (err) {
        console.error('Error in scaleDelete:', err);
        if (err instanceof ApolloError) throw err;
        throw new ApolloError('Failed to delete scale', 'INTERNAL_ERROR');
      }
    },
  },
};


