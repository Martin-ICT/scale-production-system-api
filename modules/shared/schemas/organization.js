const { gql } = require('apollo-server-express');

module.exports = gql`
  type Organization {
    plantCode: String
    plantName: String
    productionLocation: String
  }
`;
