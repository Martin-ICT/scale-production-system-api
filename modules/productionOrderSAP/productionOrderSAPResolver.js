require('dotenv').config();
const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize, where } = require('sequelize');
const axios = require('axios');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const ProductionOrderSAP = require('../../models/productionOrderSAP');
const ProductionOrderDetail = require('../../models/productionOrderDetail');
const ScaleAssignment = require('../../models/scaleAssignment');
const Material = require('../../models/material');
const MaterialUom = require('../../models/materialUom');
const Organization = require('../../models/organization');
const ElementValue = require('../../models/elementValue');
const hasPermission = require('../../middlewares/hasPermission');
const isAuthenticated = require('../../middlewares/isAuthenticated');

const validationSchemas = {
  productionOrderSAPCreate: Joi.object({
    productionOrderNumber: Joi.string().required().min(1).max(255),
    plantCode: Joi.string().required(),
    orderTypeCode: Joi.string().required().max(4),
    materialCode: Joi.string().required(),
    targetWeight: Joi.number().integer().required().min(1),
  }),
  productionOrderSAPUpdate: Joi.object({
    targetWeight: Joi.number().integer().optional().min(1),
    productionDate: Joi.date().optional(),
    suitability: Joi.number().integer().optional(),
    status: Joi.number().integer().optional().min(0),
  }),
  productionOrderSAPUpdateStatus: Joi.object({
    id: Joi.number().integer().required(),
    status: Joi.number().integer().required().min(0),
  }),
};

const validateInput = (schema, data) => {
  const { error } = schema.validate(data, {
    convert: true,
    abortEarly: false,
    allowUnknown: true,
  });
  if (error) joiErrorCallback(error);
};

// Helper function to throw simplified error message for productionOrderSAPCreateAndUpdate
const throwSimpleError = (
  message,
  code = apolloErrorCodes.BAD_DATA_VALIDATION
) => {
  const error = new ApolloError(message, code);
  // Remove stacktrace and other details to simplify error response
  error.stack = undefined;
  // Clean up extensions to only keep code
  if (error.extensions) {
    error.extensions = {
      code: error.extensions.code || code,
    };
  }
  throw error;
};

// Helper function to get SAP API configuration based on environment
const getSAPUpdatePOConfig = () => {
  const env = process.env.NODE_ENV || 'development';

  // Determine which environment config to use
  let url, user, password, client;

  if (env === 'production' || process.env.SAP_ENV === 'prod') {
    // Production environment
    url =
      process.env.SAP_UPDATE_PO_URL_PROD ||
      'http://10.1.10.16:8000/sap/bc/zws/';
    user = process.env.SAP_UPDATE_PO_USER_PROD || 'auto';
    password = process.env.SAP_UPDATE_PO_PASSWORD_PROD || 'initial';
    client = process.env.SAP_UPDATE_PO_CLIENT_PROD || '160';
  } else if (env === 'qa' || process.env.SAP_ENV === 'qa') {
    // QA environment
    url =
      process.env.SAP_UPDATE_PO_URL_QA ||
      'http://10.204.10.15:8001/sap/bc/zws/';
    user = process.env.SAP_UPDATE_PO_USER_QA || 'auto';
    password = process.env.SAP_UPDATE_PO_PASSWORD_QA || 'initial';
    client = process.env.SAP_UPDATE_PO_CLIENT_QA || '462';
  } else {
    // Development environment (default)
    url =
      process.env.SAP_UPDATE_PO_URL_DEV ||
      'http://10.204.10.15:8000/sap/bc/zws/';
    user = process.env.SAP_UPDATE_PO_USER_DEV || 'auto_ws';
    password = process.env.SAP_UPDATE_PO_PASSWORD_DEV || 'initial';
    client = process.env.SAP_UPDATE_PO_CLIENT_DEV || '363';
  }

  // Append endpoint if not already included
  const endpoint = 'zfmws_update_zppcpfint_uppo';
  if (!url.endsWith(endpoint)) {
    url = url.endsWith('/') ? `${url}${endpoint}` : `${url}/${endpoint}`;
  }

  return { url, user, password, client };
};

// Helper function to fetch productionLocation (ElementValue) based on plantCode
const attachProductionLocationToResults = async (results) => {
  if (!results || (Array.isArray(results) && results.length === 0)) {
    return;
  }

  const resultArray = Array.isArray(results) ? results : [results];

  // Get unique plantCodes
  const plantCodes = [
    ...new Set(
      resultArray
        .map((item) => item?.plantCode)
        .filter((code) => typeof code === 'string' && code.trim().length > 0)
    ),
  ];

  if (plantCodes.length === 0) {
    resultArray.forEach((item) => {
      if (item?.setDataValue) item.setDataValue('productionLocation', null);
    });
    return;
  }

  // Fetch organizations by plantCode
  const organizations = await Organization.findAll({
    where: {
      code: { [Sequelize.Op.in]: plantCodes },
    },
    attributes: ['id', 'code', 'productionLocationId'],
  });

  // Create map of plantCode -> productionLocationId
  const plantCodeToLocationIdMap = {};
  const productionLocationIds = [];

  organizations.forEach((org) => {
    plantCodeToLocationIdMap[org.code] = org.productionLocationId;
    if (org.productionLocationId) {
      productionLocationIds.push(org.productionLocationId);
    }
  });

  // Fetch ElementValues (production locations)
  let productionLocationMap = {};
  if (productionLocationIds.length > 0) {
    const elementValues = await ElementValue.findAll({
      where: {
        id: { [Sequelize.Op.in]: productionLocationIds },
      },
      attributes: ['id', 'code', 'name', 'description'],
    });

    productionLocationMap = elementValues.reduce((acc, ev) => {
      acc[ev.id] = ev.toJSON();
      return acc;
    }, {});
  }

  // Attach productionLocation to each result
  resultArray.forEach((item) => {
    if (!item || !item.plantCode) {
      if (item?.setDataValue) item.setDataValue('productionLocation', null);
      return;
    }

    const productionLocationId = plantCodeToLocationIdMap[item.plantCode];
    const productionLocation = productionLocationId
      ? productionLocationMap[productionLocationId] || null
      : null;

    if (item.setDataValue) {
      item.setDataValue('productionLocation', productionLocation);
    } else {
      item.productionLocation = productionLocation;
    }
  });
};

// Define association for ProductionOrderSAP hasMany ProductionOrderDetail
ProductionOrderSAP.hasMany(ProductionOrderDetail, {
  foreignKey: 'productionOrderId',
  as: 'productionOrderDetails',
});

module.exports = {
  Query: {
    productionOrderSAPList: combineResolvers(
      isAuthenticated,
      // hasPermission('productionOrderSAP.read'),
      pageMinCheckAndPageSizeMax,
      async (
        _,
        {
          page = 0,
          pageSize = 10,
          search = null,
          sort = { columnName: 'createdAt', sortOrder: 'DESC' },
          filter,
        }
      ) => {
        try {
          let whereClause = {};

          if (search) {
            whereClause = definedSearch({
              query: search,
              inColumns: ['productionOrderNumber', 'materialCode'],
            });
          }

          if (filter?.productionOrderNumber) {
            whereClause.productionOrderNumber = filter.productionOrderNumber;
          }

          if (filter?.plantCode) {
            whereClause.plantCode = filter.plantCode;
          }

          if (filter?.orderTypeCode) {
            whereClause.orderTypeCode = filter.orderTypeCode;
          }

          if (filter?.materialCode) {
            whereClause.materialCode = filter.materialCode;
          }

          if (filter?.status !== undefined) {
            if (filter.status === 'active') {
              whereClause.status = { [Sequelize.Op.in]: [1, 2] };
            }
            if (filter.status === 'inactive') {
              whereClause.status = { [Sequelize.Op.in]: [3] };
            }
          }

          // Handle date range filter using DateFilter (general name for reusability)
          if (filter?.date) {
            const { startDate, endDate } = filter.date;
            if (startDate && endDate) {
              // Both dates provided: filter by range
              // Set startDate to start of day (00:00:00.000) and endDate to end of day (23:59:59.999)
              const fromDate = new Date(startDate);
              fromDate.setHours(0, 0, 0, 0);
              const toDate = new Date(endDate);
              toDate.setHours(23, 59, 59, 999);

              whereClause.productionDate = {
                [Sequelize.Op.between]: [fromDate, toDate],
              };
            } else if (startDate) {
              // Only startDate provided: filter from this date onwards (start of day)
              const fromDate = new Date(startDate);
              fromDate.setHours(0, 0, 0, 0);
              whereClause.productionDate = {
                [Sequelize.Op.gte]: fromDate,
              };
            } else if (endDate) {
              // Only endDate provided: filter up to this date (end of day)
              const toDate = new Date(endDate);
              toDate.setHours(23, 59, 59, 999);
              whereClause.productionDate = {
                [Sequelize.Op.lte]: toDate,
              };
            }
          }

          // Handle scaleId filter through ScaleAssignment -> ProductionOrderDetail -> ProductionOrderSAP
          let includeOptions = [
            {
              model: ProductionOrderDetail,
              as: 'productionOrderDetails',
              required: false,
            },
          ];

          if (filter?.scaleId) {
            // When filtering by scaleId, we need to include ScaleAssignment
            // and make ProductionOrderDetail required to ensure we only get ProductionOrderSAP
            // that have ProductionOrderDetails with the specified scaleId
            includeOptions = [
              {
                model: ProductionOrderDetail,
                as: 'productionOrderDetails',
                required: true,
                include: [
                  {
                    model: ScaleAssignment,
                    as: 'scaleAssignments',
                    required: true,
                    where: {
                      scaleId: filter.scaleId,
                    },
                  },
                ],
              },
            ];
          }

          // For count, we need to handle scaleId filter differently
          let countOptions = {
            where: whereClause,
            distinct: true,
            col: 'id',
          };

          if (filter?.scaleId) {
            countOptions.include = [
              {
                model: ProductionOrderDetail,
                as: 'productionOrderDetails',
                required: true,
                include: [
                  {
                    model: ScaleAssignment,
                    as: 'scaleAssignments',
                    required: true,
                    where: {
                      scaleId: filter.scaleId,
                    },
                  },
                ],
              },
            ];
          }

          const countResult = await ProductionOrderSAP.count(countOptions);

          const result = await ProductionOrderSAP.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
            include: includeOptions,
            distinct: true,
          });

          // Fetch material descriptions from WMS database
          const uniqueMaterialCodes = [
            ...new Set(result.map((item) => item.materialCode)),
          ];

          let materialMap = {};
          if (uniqueMaterialCodes.length > 0) {
            const materials = await Material.findAll({
              where: {
                code: { [Sequelize.Op.in]: uniqueMaterialCodes },
                clientId: 1000009,
              },
              attributes: ['code', 'name'],
            });

            materialMap = materials.reduce((acc, material) => {
              acc[material.code] = material.name;
              return acc;
            }, {});
          }

          // Add materialDescription to each result
          const resultWithDescription = result.map((item) => {
            const productionOrderSAP = item.toJSON();
            productionOrderSAP.materialDescription =
              materialMap[item.materialCode] || null;
            return productionOrderSAP;
          });

          // Attach productionLocation (ElementValue) based on plantCode
          await attachProductionLocationToResults(resultWithDescription);

          return {
            productionOrderSAPs: resultWithDescription,
            meta: {
              totalItems: countResult,
              pageSize,
              currentPage: page,
              totalPages: Math.ceil(countResult / pageSize),
            },
          };
        } catch (err) {
          throw err;
        }
      }
    ),

    productionOrderSAPDetail: combineResolvers(
      isAuthenticated,
      // hasPermission('productionOrderSAP.read'),
      async (_, { id }) => {
        try {
          const productionOrderSAP = await ProductionOrderSAP.findByPk(id, {
            include: [
              {
                model: ProductionOrderDetail,
                as: 'productionOrderDetails',
                required: false,
              },
            ],
          });

          if (!productionOrderSAP) {
            throw new ApolloError(
              'ProductionOrderSAP not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Fetch material description from WMS database
          let materialDescription = null;
          if (productionOrderSAP.materialCode) {
            const material = await Material.findOne({
              where: {
                code: productionOrderSAP.materialCode,
                clientId: 1000009,
              },
              attributes: ['name'],
            });

            materialDescription = material?.name || null;
          }

          // Add materialDescription to result
          const result = productionOrderSAP.toJSON();
          result.materialDescription = materialDescription;

          // Attach productionLocation (ElementValue) based on plantCode
          await attachProductionLocationToResults(result);

          return result;
        } catch (err) {
          throw err;
        }
      }
    ),
  },

  Mutation: {
    productionOrderSAPCreate: combineResolvers(
      // hasPermission('productionOrderSAP.create'),
      async (_, { input }, { user }) => {
        validateInput(validationSchemas.productionOrderSAPCreate, input);
        const transaction = await ProductionOrderSAP.sequelize.transaction();

        try {
          // Fetch material from WMS by material code to derive UOM (and validate existence)
          const material = await Material.findOne({
            where: {
              code: input.materialCode,
              clientId: 1000009,
            },
            include: [
              {
                model: MaterialUom,
                as: 'uom',
                attributes: ['code'],
                where: { clientId: 1000009 },
                required: false,
              },
            ],
          });

          if (!material) {
            throw new ApolloError(
              'Material not found in WMS for provided materialCode',
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          const existingProductionOrderSAP = await ProductionOrderSAP.findOne({
            where: {
              productionOrderNumber: input.productionOrderNumber,
              materialCode: input.materialCode,
            },
          });

          if (existingProductionOrderSAP) {
            throw new ApolloError(
              'A production order with the same number and material code already exists',
              apolloErrorCodes.BAD_DATA_VALIDATION
            );
          }

          // If not exists, create new record
          const payload = {
            productionOrderNumber: input.productionOrderNumber,
            plantCode: input.plantCode,
            orderTypeCode: input.orderTypeCode,
            materialCode: input.materialCode,
            targetWeight: input.targetWeight,
            productionDate: input.productionDate,
            suitability: input.suitability,
            // optional/derived with safe defaults if not provided
            uom: input.uom ?? material?.uom?.code ?? 'KG',
            status: input.status ?? 1,
          };

          const newProductionOrderSAP = await ProductionOrderSAP.create(
            payload,
            {
              transaction,
            }
          );

          await transaction.commit();
          return newProductionOrderSAP;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    productionOrderSAPCreateAndUpdate: combineResolvers(
      // hasPermission('productionOrderSAP.create'),
      async (_, { input }, { user }) => {
        validateInput(validationSchemas.productionOrderSAPCreate, input);
        const transaction = await ProductionOrderSAP.sequelize.transaction();

        try {
          // Fetch material from WMS by material code to derive UOM (and validate existence)
          const material = await Material.findOne({
            where: {
              code: input.materialCode,
              clientId: 1000009,
            },
            include: [
              {
                model: MaterialUom,
                as: 'uom',
                attributes: ['code'],
                where: { clientId: 1000009 },
                required: false,
              },
            ],
          });

          if (!material) {
            throwSimpleError(
              'Material not found in WMS for provided materialCode'
            );
          }

          const existingProductionOrderSAP = await ProductionOrderSAP.findOne({
            where: {
              productionOrderNumber: input.productionOrderNumber,
              materialCode: input.materialCode,
            },
          });

          // If exists, update only allowed fields
          if (existingProductionOrderSAP) {
            const updatePayload = {};

            if (input.targetWeight !== undefined) {
              updatePayload.targetWeight = input.targetWeight;
            }
            if (input.productionDate !== undefined) {
              updatePayload.productionDate = input.productionDate;
            }
            if (input.suitability !== undefined) {
              updatePayload.suitability = input.suitability;
            }
            if (input.status !== undefined) {
              updatePayload.status = input.status;
            }

            await existingProductionOrderSAP.update(updatePayload, {
              transaction,
            });

            await transaction.commit();
            return existingProductionOrderSAP;
          }

          // If not exists, create new record
          // Validate required fields for create
          if (!input.plantCode) {
            throwSimpleError(
              'plantCode is required for creating new production order'
            );
          }
          if (!input.orderTypeCode) {
            throwSimpleError(
              'orderTypeCode is required for creating new production order'
            );
          }
          if (!input.targetWeight) {
            throwSimpleError(
              'targetWeight is required for creating new production order'
            );
          }
          if (!input.productionDate) {
            throwSimpleError(
              'productionDate is required for creating new production order'
            );
          }
          if (input.suitability === undefined || input.suitability === null) {
            throwSimpleError(
              'suitability is required for creating new production order'
            );
          }

          const payload = {
            productionOrderNumber: input.productionOrderNumber,
            plantCode: input.plantCode,
            orderTypeCode: input.orderTypeCode,
            materialCode: input.materialCode,
            targetWeight: input.targetWeight,
            productionDate: input.productionDate,
            suitability: input.suitability,
            // optional/derived with safe defaults if not provided
            uom: input.uom ?? material?.uom?.code ?? 'KG',
            status: input.status ?? 1,
          };

          const newProductionOrderSAP = await ProductionOrderSAP.create(
            payload,
            {
              transaction,
            }
          );

          await transaction.commit();
          return newProductionOrderSAP;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    productionOrderSAPUpdate: combineResolvers(
      // hasPermission('productionOrderSAP.update'),
      async (_, { id, input }, { user }) => {
        validateInput(validationSchemas.productionOrderSAPUpdate, input);
        const transaction = await ProductionOrderSAP.sequelize.transaction();

        try {
          // Find existing production order
          const existingProductionOrderSAP = await ProductionOrderSAP.findByPk(
            id
          );

          if (!existingProductionOrderSAP) {
            throw new ApolloError(
              'ProductionOrderSAP not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Build update payload with only provided fields
          const payload = {};

          if (input.targetWeight !== undefined) {
            payload.targetWeight = input.targetWeight;
          }
          if (input.productionDate !== undefined) {
            payload.productionDate = input.productionDate;
          }
          if (input.suitability !== undefined) {
            payload.suitability = input.suitability;
          }
          if (input.status !== undefined) {
            payload.status = input.status;
          }

          await existingProductionOrderSAP.update(payload, {
            transaction,
          });

          await transaction.commit();
          return existingProductionOrderSAP;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    productionOrderSAPUpdateStatus: combineResolvers(
      // hasPermission('productionOrderSAP.update'),
      async (_, { productionOrderNumber, status }) => {
        validateInput(validationSchemas.productionOrderSAPUpdateStatus, {
          id: 1,
          status,
        });

        const transaction = await ProductionOrderSAP.sequelize.transaction();

        try {
          const productionOrderSAP = await ProductionOrderSAP.findOne({
            where: { productionOrderNumber },
          });
          if (!productionOrderSAP) {
            throw new ApolloError(
              'Production Order SAP not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Get old status before update
          // const oldStatus = productionOrderSAP.status;

          // Update status in database
          await productionOrderSAP.update({ status }, { transaction });
          await transaction.commit();

          try {
            const sapConfig = getSAPUpdatePOConfig();

            // Prepare SAP request body
            const sapRequestBody = {
              DATA: [
                {
                  CAUFV_AUFNR: productionOrderNumber,
                  KEY_STATUS: status,
                },
              ],
            };

            // Call SAP API
            const sapResponse = await axios.post(
              sapConfig.url,
              sapRequestBody,
              {
                headers: {
                  'sap-user': sapConfig.user,
                  'sap-password': sapConfig.password,
                  'sap-client': sapConfig.client,
                  'Content-Type': 'application/json',
                },
                timeout: 30000, // 30 seconds timeout
              }
            );

            // Log success (optional - can be removed if not needed)
            if (sapResponse.status >= 200 && sapResponse.status < 300) {
              console.log(
                `✅ Successfully updated PO status in SAP: ${productionOrderNumber}`
              );
            }
          } catch (sapError) {
            // Log SAP API error but don't fail the mutation
            // The status update in database has already been committed
            console.error('❌ SAP API Error when updating PO status:', {
              productionOrderNumber,
              error: sapError.message,
              response: sapError.response?.data,
              statusCode: sapError.response?.status,
            });

            // Optionally, you can throw error here if you want to fail the mutation
            // For now, we'll just log the error and continue
            // throw new ApolloError(
            //   `SAP API Error: ${sapError.response?.data?.message || sapError.message || 'Failed to update status in SAP'}`,
            //   apolloErrorCodes.INTERNAL_SERVER_ERROR,
            //   {
            //     sapResponse: sapError.response?.data,
            //     statusCode: sapError.response?.status,
            //   }
            // );
          }

          return productionOrderSAP;
        } catch (err) {
          if (!transaction.finished) {
            await transaction.rollback();
          }
          throw err;
        }
      }
    ),
  },

  // Field resolvers
  ProductionOrderSAP: {
    productionOrderDetail: async (productionOrderSAP) => {
      try {
        // If already included in query, return it
        if (productionOrderSAP.productionOrderDetails) {
          return productionOrderSAP.productionOrderDetails;
        }

        // Otherwise, fetch from database
        const productionOrderDetails = await ProductionOrderDetail.findAll({
          where: {
            productionOrderId: productionOrderSAP.id,
          },
        });

        return productionOrderDetails;
      } catch (error) {
        console.error(
          'Error fetching productionOrderDetail for ProductionOrderSAP:',
          error
        );
        return [];
      }
    },
  },
};
