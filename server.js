require('dotenv').config();
const { ApolloServer, ApolloError } = require('apollo-server');
const typeDefs = require('./schemas');
const resolvers = require('./resolvers');
const authenticate = require('./middlewares/authenticate');
const models = require('./models');
const { Op } = require('sequelize');
const {
  startCronJob: startWeightSummaryBatchCronJob,
} = require('./cronjobs/weightSummaryBatchCreateFromScaleResults');

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  // Force local embedded sandbox (tidak redirect ke Apollo Studio)
  plugins: [
    require('apollo-server-core').ApolloServerPluginLandingPageLocalDefault({
      embed: true,
    }),
  ],
  cors: {
    origin: '*', // Allow all origins for development
    credentials: true,
  },
  context: async ({ req }) => {
    const { user, authError } = await authenticate({ req });
    return {
      models,
      user,
      authError,
    };
  },
  formatError: (err) => {
    // Tangkap SequelizeUniqueConstraintError dari `originalError`
    const original = err.originalError;

    if (original && original.name === 'SequelizeUniqueConstraintError') {
      const details = original.errors.reduce((acc, e) => {
        acc[e.path] = e.message;
        return acc;
      }, {});

      return new ApolloError(
        'Unique constraint validation failed',
        'BAD_DATA_VALIDATION',
        { details }
      );
    }

    // Simplify GraphQL validation errors (BAD_USER_INPUT) - only for validation errors
    if (
      err.extensions?.code === 'BAD_USER_INPUT' &&
      err.message?.includes('Variable "$input"')
    ) {
      // Extract field name from error message
      const fieldMatch = err.message.match(/at "input\.(\w+)"/);
      const fieldName = fieldMatch ? fieldMatch[1] : null;

      // Create simplified error message
      let simplifiedMessage = err.message.split(';')[0] || err.message;
      if (fieldName) {
        simplifiedMessage = `${fieldName} is required`;
      }

      return {
        message: simplifiedMessage,
        extensions: {
          code: 'BAD_USER_INPUT',
        },
      };
    }

    // Simplify resolver errors with BAD_DATA_VALIDATION code (from productionOrderSAPCreateAndUpdate)
    if (err.extensions?.code === 'BAD_DATA_VALIDATION') {
      return {
        message: err.message,
        extensions: {
          code: 'BAD_DATA_VALIDATION',
        },
      };
    }

    // Error lain biarin aja
    return err;
  },
});

models.sequelize
  // .sync({ force: true }) // ⚠️ DANGER: Drops all tables and recreates them (DATA LOSS)
  // .sync({ alter: true }) // ⚠️ ERROR: Doesn't work well with ENUM columns in PostgreSQL
  .sync() // ✅ Default: Only creates missing tables, doesn't alter existing ones
  // Note: To change ENUM or column types, use manual SQL migration instead
  .then(() => {
    console.log('Database connected and models synced!');
    server.listen(4000, '0.0.0.0').then(({ url }) => {
      console.log(`🚀 Server ready at ${url}`);

      // Start cronjobs
      startWeightSummaryBatchCronJob();
    });
  })
  .catch((err) => {
    console.error('Failed to sync database:', err);
  });
