const { gql } = require('apollo-server');
const companySchema = require('./modules/company/companySchema');
const plantSchema = require('./modules/plant/plantSchema');
const scaleSchema = require('./modules/scale/scaleSchema');

//shared
const dateFilterSchema = require('./modules/shared/schemas/dateFilter');
const paginationSchema = require('./modules/shared/schemas/pagination');
const sortSchema = require('./modules/shared/schemas/sort');
const searchSchema = require('./modules/shared/schemas/search');
const statusSchema = require('./modules/shared/schemas/status');

module.exports = gql`
  scalar Upload
  scalar JSON
  scalar Date
  scalar DateTime
  scalar EmailAddress
  scalar PhoneNumber
  type Query
  type Mutation
  ${companySchema}
  ${plantSchema}
  ${scaleSchema}
  ${dateFilterSchema}
  ${paginationSchema}
  ${sortSchema}
  ${searchSchema}
  ${statusSchema}
`;
