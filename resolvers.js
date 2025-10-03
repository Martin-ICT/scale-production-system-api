const { GraphQLDateTime, GraphQLDate } = require('graphql-iso-date');
const GraphQLJSON = require('graphql-type-json');
const {
  EmailAddressResolver,
  PhoneNumberResolver,
} = require('graphql-scalars');

const companyResolver = require('./modules/company/companyResolver');
// const plantResolver = require('./modules/plant/resolver');
const scaleResolver = require('./modules/scale/scaleResolver');

module.exports = {
  DateTime: GraphQLDateTime,
  Date: GraphQLDate,
  JSON: GraphQLJSON,
  EmailAddress: EmailAddressResolver,
  PhoneNumber: PhoneNumberResolver,
  Query: {
    ...companyResolver.Query,
    // ...plantResolver.Query,
    ...scaleResolver.Query,
  },
  Mutation: {
    ...companyResolver.Mutation,
    // ...plantResolver.Mutation,
    ...scaleResolver.Mutation,
  },
};
