const { gql } = require('apollo-server');

module.exports = gql`
  extend type Query {
    companyList(
      page: Int
      pageSize: Int
      search: String
      filter: CompanyFilter
      sort: SortBy
    ): CompanyPagination
    companyDetail(id: ID!): Company
  }

  extend type Mutation {
    companyCreate(input: CompanyInputCreate!): Company
    companyUpdate(id: ID!, input: CompanyInputUpdate!): Company
    companyDelete(id: ID!): Company
  }

  input CompanyInputCreate {
    name: String!
    code: String!
  }

  input CompanyInputUpdate {
    name: String
    code: String
  }

  type Company {
    id: ID!
    name: String!
    code: String
    status: String
    plants: [Plant]
    createdAt: String
    updatedAt: String
  }

  type CompanyPagination {
    companies: [Company]
    meta: PaginationMeta!
  }

  input CompanyFilter {
    name: String
    code: String
    status: String
    createdDate: DateFilter
  }
`;
