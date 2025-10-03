const { gql } = require('apollo-server-express');

module.exports = gql`
  enum Platform {
    all
    web
    mobile
  }
`;
