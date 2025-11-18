const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize, where } = require('sequelize');
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
            whereClause.status = filter.status;
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

          await productionOrderSAP.update({ status }, { transaction });

          await transaction.commit();
          return productionOrderSAP;
        } catch (err) {
          await transaction.rollback();
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
