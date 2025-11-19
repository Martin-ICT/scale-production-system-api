const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    dashboardSummary: DashboardSummary!
  }

  type DashboardSummary {
    totalMaterial: Int!
    totalProductionOrderDetail: Int!
    totalProductionSAP: Int!
    totalWeight: Float!
  }
`;
