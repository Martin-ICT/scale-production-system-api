const { gql } = require('apollo-server');

module.exports = gql`
  extend type Mutation {
    scaleResultsCreate(input: ScaleResultsInputCreate!): ScaleResults
  }

  input ScaleResultsInputCreate {
    scaleId: String!
    productionOrderNumber: String
    plant: String
    materialCode: String
    materialUom: String
    weight: Float
    uom: String
    weightConverted: Float
    productionGroup: String
    productionShift: Int
    packingGroup: String
    packingShift: Int
    productionLot: String
    productionLocation: String
    userId: Int
    username: String
    storageLocation: String
    scaleTransactionId: String
  }

  type ScaleResults {
    id: Int!
    scaleTransactionId: String
    scaleId: String
    productionOrderNumber: String
    plant: String
    materialCode: String
    materialUom: String
    weight: Float
    uom: String
    weightConverted: Float
    productionGroup: String
    productionShift: Int
    packingGroup: String
    packingShift: Int
    productionLot: String
    productionLocation: String
    userId: Int
    username: String
    storageLocation: String
    createdAt: DateTime!
  }
`;

