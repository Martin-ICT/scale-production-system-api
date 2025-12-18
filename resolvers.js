const { GraphQLDateTime, GraphQLDate } = require('graphql-iso-date');
const GraphQLJSON = require('graphql-type-json');
const {
  EmailAddressResolver,
  PhoneNumberResolver,
} = require('graphql-scalars');

const plantResolver = require('./modules/plant/plantResolver');
const authResolver = require('./modules/auth/authResolver');
const scaleResolver = require('./modules/scale/scaleResolver');
const scaleAssignmentResolver = require('./modules/scaleAssignment/scaleAssignmentResolver');
const scaleResultsResolver = require('./modules/scaleResults/scaleResultsResolver');
const productionOrderSAPResolver = require('./modules/productionOrderSAP/productionOrderSAPResolver');
const productionOrderDetailResolver = require('./modules/productionOrderDetail/productionOrderDetailResolver');
const packingGroupResolver = require('./modules/packingGroup/packingGroupResolver');
const packingShiftResolver = require('./modules/packingShift/packingShiftResolver');
const productionLotResolver = require('./modules/productionLot/productionLotResolver');
const productionGroupResolver = require('./modules/productionGroup/productionGroupResolver');
const productionShiftResolver = require('./modules/productionShift/productionShiftResolver');
const storageLocationResolver = require('./modules/storageLocation/storageLocationResolver');
const storageLocationTargetResolver = require('./modules/storageLocationTarget/storageLocationTargetResolver');
const orderTypeResolver = require('./modules/orderType/orderTypeResolver');
const materialResolver = require('./modules/material/materialResolver');
const materialOrderTypeResolver = require('./modules/materialOrderType/materialOrderTypeResolver');
const elementValueResolver = require('./modules/elementValue/elementValueResolver');
const weightSummaryBatchResolver = require('./modules/weightSummaryBatch/weightSummaryBatchResolver');
const dashboardResolver = require('./modules/dashboard/dashboardResolver');

module.exports = {
  DateTime: GraphQLDateTime,
  Date: GraphQLDate,
  JSON: GraphQLJSON,
  EmailAddress: EmailAddressResolver,
  PhoneNumber: PhoneNumberResolver,
  Decimal: {
    parseValue: (value) => {
      return parseFloat(value);
    },
    serialize: (value) => {
      return value ? parseFloat(value) : null;
    },
    parseLiteral: (ast) => {
      return parseFloat(ast.value);
    },
  },
  Query: {
    ...plantResolver.Query,
    ...authResolver.Query,
    ...scaleResolver.Query,
    ...productionOrderSAPResolver.Query,
    ...productionOrderDetailResolver.Query,
    ...packingGroupResolver.Query,
    ...packingShiftResolver.Query,
    ...productionLotResolver.Query,
    ...productionGroupResolver.Query,
    ...productionShiftResolver.Query,
    ...storageLocationResolver.Query,
    ...storageLocationTargetResolver.Query,
    ...orderTypeResolver.Query,
    ...materialResolver.Query,
    ...materialOrderTypeResolver.Query,
    ...elementValueResolver.Query,
    ...scaleResolver.Query,
    ...scaleAssignmentResolver.Query,
    ...scaleResultsResolver.Query,
    ...weightSummaryBatchResolver.Query,
    ...dashboardResolver.Query,
  },
  Material: {
    ...materialResolver.Material,
  },
  ProductionOrderDetail: {
    ...productionOrderDetailResolver.ProductionOrderDetail,
  },
  Mutation: {
    ...authResolver.Mutation,
    ...scaleResolver.Mutation,
    ...productionOrderSAPResolver.Mutation,
    ...productionOrderDetailResolver.Mutation,
    ...packingGroupResolver.Mutation,
    ...packingShiftResolver.Mutation,
    ...productionLotResolver.Mutation,
    ...productionGroupResolver.Mutation,
    ...productionShiftResolver.Mutation,
    ...storageLocationResolver.Mutation,
    ...storageLocationTargetResolver.Mutation,
    ...orderTypeResolver.Mutation,
    ...scaleResolver.Mutation,
    ...scaleAssignmentResolver.Mutation,
    ...scaleResultsResolver.Mutation,
    ...weightSummaryBatchResolver.Mutation,
  },
};
