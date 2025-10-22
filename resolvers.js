const { GraphQLDateTime, GraphQLDate } = require('graphql-iso-date');
const GraphQLJSON = require('graphql-type-json');
const {
  EmailAddressResolver,
  PhoneNumberResolver,
} = require('graphql-scalars');

// const plantResolver = require('./modules/plant/resolver');
const scaleResolver = require('./modules/scale/scaleResolver');
const productionOrderSAPResolver = require('./modules/productionOrderSAP/productionOrderSAPResolver');
const packingGroupResolver = require('./modules/packingGroup/packingGroupResolver');
const packingShiftResolver = require('./modules/packingShift/packingShiftResolver');
const productionLotResolver = require('./modules/productionLot/productionLotResolver');
const productionGroupResolver = require('./modules/productionGroup/productionGroupResolver');
const productionShiftResolver = require('./modules/productionShift/productionShiftResolver');
const storageLocationResolver = require('./modules/storageLocation/storageLocationResolver');

module.exports = {
  DateTime: GraphQLDateTime,
  Date: GraphQLDate,
  JSON: GraphQLJSON,
  EmailAddress: EmailAddressResolver,
  PhoneNumber: PhoneNumberResolver,
  Query: {
    // ...plantResolver.Query,
    ...scaleResolver.Query,
    ...productionOrderSAPResolver.Query,
    ...packingGroupResolver.Query,
    ...packingShiftResolver.Query,
    ...productionLotResolver.Query,
    ...productionGroupResolver.Query,
    ...productionShiftResolver.Query,
    ...storageLocationResolver.Query,
  },
  Mutation: {
    // ...plantResolver.Mutation,
    ...scaleResolver.Mutation,
    ...productionOrderSAPResolver.Mutation,
    ...packingGroupResolver.Mutation,
    ...packingShiftResolver.Mutation,
    ...productionLotResolver.Mutation,
    ...productionGroupResolver.Mutation,
    ...productionShiftResolver.Mutation,
    ...storageLocationResolver.Mutation,
  },
};
