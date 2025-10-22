require('dotenv').config();
const { ApolloServer, ApolloError } = require('apollo-server');
const typeDefs = require('./schemas');
const resolvers = require('./resolvers');
// const User = require('./models/user');
const authenticate = require('./middlewares/authenticate');
const models = require('./models');
const { Op } = require('sequelize');

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
  //   context: async ({ req }) => {
  //     try {
  //       const { user } = await authenticate({ req });
  //       const currentUser = await handleRoleAndPermission(user);
  //       return {
  //         models,
  //         user: currentUser,
  //       };
  //     } catch {
  //       throw new ApolloError('Session expired. Please log in again.');
  //     }
  //   },
  formatError: (err) => {
    // Tangkap SequelizeUniqueConstraintError dari `originalError`
    const original = err.originalError;

    if (original?.name === 'SequelizeUniqueConstraintError') {
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

    // Error lain biarin aja
    return err;
  },
});

models.sequelize
  // .sync({ force: true })
  .sync()
  .then(() => {
    console.log('Database connected and models synced!');
    server.listen(5000, '0.0.0.0').then(({ url }) => {
      console.log(`🚀 Server ready at ${url}`);
    });
  })
  .catch((err) => {
    console.error('Failed to sync database:', err);
  });
