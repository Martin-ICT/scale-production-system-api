const { ApolloError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');
const Joi = require('joi');
const { Sequelize } = require('sequelize');
const apolloErrorCodes = require('../../constants/apolloErrorCodes');
const pageMinCheckAndPageSizeMax = require('../../middlewares/pageMinCheckAndPageSizeMax');
const { joiErrorCallback } = require('../../helpers/errorHelper');
const definedSearch = require('../../helpers/definedSearch');
const ProductionOrderDetail = require('../../models/productionOrderDetail');
const ProductionOrderSAP = require('../../models/productionOrderSAP');
const OrderType = require('../../models/orderType');
const Material = require('../../models/material');
const MaterialUom = require('../../models/materialUom');
const ScaleAssignment = require('../../models/scaleAssignment');
const Scale = require('../../models/scale');
const hasPermission = require('../../middlewares/hasPermission');
const isAuthenticated = require('../../middlewares/isAuthenticated');

// Mapping GraphQL ENUM <-> Database values (same as scaleResolver)
const UOM_MAP = {
  // GraphQL -> Database
  KG: 'kg',
  G: 'g',
  // Database -> GraphQL (string keys match DB ENUM values)
  kg: 'KG',
  g: 'G',
};

const STATUS_MAP = {
  // GraphQL -> Database
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  // Database -> GraphQL (string keys match DB ENUM values)
  active: 'ACTIVE',
  inactive: 'INACTIVE',
};

const MATERIAL_CLIENT_ID = 1000009;

const attachMaterialToDetails = async (details) => {
  if (!details || (Array.isArray(details) && details.length === 0)) {
    return;
  }

  const detailArray = Array.isArray(details) ? details : [details];

  const materialCodes = [
    ...new Set(
      detailArray
        .map((item) => item?.materialCode)
        .filter((code) => typeof code === 'string' && code.trim().length > 0)
    ),
  ];

  if (materialCodes.length === 0) {
    detailArray.forEach((item) => {
      if (item?.setDataValue) item.setDataValue('material', null);
    });
    return;
  }

  const materials = await Material.findAll({
    where: {
      code: { [Sequelize.Op.in]: materialCodes },
      clientId: MATERIAL_CLIENT_ID,
    },
    include: [
      {
        model: MaterialUom,
        as: 'uom',
        required: false,
        attributes: ['id', 'clientId', 'code', 'name'],
      },
    ],
  });

  const materialMap = materials.reduce((acc, material) => {
    acc[material.code] = material.toJSON();
    return acc;
  }, {});

  detailArray.forEach((item) => {
    if (!item || !item.materialCode) {
      if (item?.setDataValue) item.setDataValue('material', null);
      return;
    }

    const material = materialMap[item.materialCode] || null;

    if (item.setDataValue) {
      item.setDataValue('material', material);
    } else {
      item.material = material;
    }
  });
};

const validationSchemas = {
  productionOrderDetailCreate: Joi.object({
    productionOrderId: Joi.number().integer().required(),
    materialCode: Joi.string().required().min(1).max(255),
    targetWeight: Joi.number().integer().required().min(1),
    orderTypeId: Joi.number().integer().optional(),
    totalWeighed: Joi.number().min(0).optional(),
    totalWeighedGoodReceive: Joi.number().min(0).optional(),
    weighingCount: Joi.number().integer().min(0).optional(),
  }),
  productionOrderDetailUpdate: Joi.object({
    materialCode: Joi.string().min(1).max(255).optional(),
    targetWeight: Joi.number().integer().min(1).optional(),
    orderTypeId: Joi.number().integer().optional(),
    totalWeighed: Joi.number().min(0).optional(),
    totalWeighedGoodReceive: Joi.number().min(0).optional(),
    weighingCount: Joi.number().integer().min(0).optional(),
  }),
  productionOrderDetailUpdateTotalWeighed: Joi.object({
    id: Joi.number().integer().required(),
    totalWeighed: Joi.number().min(0).required(),
    totalWeighedGoodReceive: Joi.number().min(0).optional(),
    weighingCount: Joi.number().integer().min(0).optional(),
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

module.exports = {
  Query: {
    productionOrderDetailList: combineResolvers(
      isAuthenticated,
      // hasPermission('productionOrderDetail.read'),
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
              inColumns: ['materialCode', 'materialDescription'],
            });
          }

          if (filter?.productionOrderId) {
            whereClause.productionOrderId = filter.productionOrderId;
          }

          if (filter?.materialCode) {
            whereClause.materialCode = filter.materialCode;
          }

          if (filter?.processingType !== undefined) {
            whereClause.processingType = filter.processingType;
          }

          if (filter?.orderTypeId !== undefined) {
            whereClause.orderTypeId = filter.orderTypeId;
          }

          const productionOrderSAPWhere = {};
          if (filter?.productionOrderNumber) {
            productionOrderSAPWhere.productionOrderNumber =
              filter.productionOrderNumber;
          }
          if (filter?.plantCode) {
            productionOrderSAPWhere.plantCode = filter.plantCode;
          }
          if (filter?.date) {
            const { startDate, endDate } = filter.date;
            if (startDate && endDate) {
              const fromDate = new Date(startDate);
              fromDate.setHours(0, 0, 0, 0);
              const toDate = new Date(endDate);
              toDate.setHours(23, 59, 59, 999);
              productionOrderSAPWhere.productionDate = {
                [Sequelize.Op.between]: [fromDate, toDate],
              };
            } else if (startDate) {
              const fromDate = new Date(startDate);
              fromDate.setHours(0, 0, 0, 0);
              productionOrderSAPWhere.productionDate = {
                [Sequelize.Op.gte]: fromDate,
              };
            } else if (endDate) {
              const toDate = new Date(endDate);
              toDate.setHours(23, 59, 59, 999);
              productionOrderSAPWhere.productionDate = {
                [Sequelize.Op.lte]: toDate,
              };
            }
          }
          const hasProductionOrderSAPFilter =
            Object.keys(productionOrderSAPWhere).length > 0;

          const productionOrderSAPInclude = {
            model: ProductionOrderSAP,
            as: 'productionOrderSAP',
            attributes: [
              'id',
              'productionOrderNumber',
              'plantCode',
              'orderTypeCode',
              'materialCode',
              'targetWeight',
              'productionDate',
              'suitability',
              'status',
              'createdAt',
            ],
            required: hasProductionOrderSAPFilter,
            ...(hasProductionOrderSAPFilter && {
              where: productionOrderSAPWhere,
            }),
          };

          let includeOptions = [
            productionOrderSAPInclude,
            {
              model: OrderType,
              as: 'orderType',
              required: false,
              attributes: ['id', 'code', 'name', 'processType', 'maxDay'],
            },
            {
              model: ScaleAssignment,
              as: 'scaleAssignments',
              required: false,
              where: {
                deletedAt: null,
              },
              include: [
                {
                  model: Scale,
                  as: 'scale',
                  required: false,
                },
              ],
            },
          ];

          if (filter?.scaleId) {
            // When filtering by scaleId, make scaleAssignments required
            includeOptions = [
              productionOrderSAPInclude,
              {
                model: OrderType,
                as: 'orderType',
                required: false,
                attributes: ['id', 'code', 'name', 'processType', 'maxDay'],
              },
              {
                model: ScaleAssignment,
                as: 'scaleAssignments',
                required: true,
                where: {
                  scaleId: filter.scaleId,
                  deletedAt: null,
                },
                include: [
                  {
                    model: Scale,
                    as: 'scale',
                    required: false,
                  },
                ],
              },
            ];
          }

          const countInclude = [];

          if (hasProductionOrderSAPFilter) {
            countInclude.push({
              model: ProductionOrderSAP,
              as: 'productionOrderSAP',
              required: true,
              attributes: [],
              where: productionOrderSAPWhere,
            });
          }

          if (filter?.scaleId) {
            countInclude.push({
              model: ScaleAssignment,
              as: 'scaleAssignments',
              required: true,
              attributes: [],
              where: {
                scaleId: filter.scaleId,
                deletedAt: null,
              },
            });
          }

          const countResult = await ProductionOrderDetail.count({
            where: whereClause,
            distinct: true,
            col: 'id',
            include: countInclude.length > 0 ? countInclude : undefined,
          });

          const result = await ProductionOrderDetail.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
            include: includeOptions,
            distinct: true,
          });

          await attachMaterialToDetails(result);

          // Extract scales from scaleAssignments and convert enum values
          const productionOrderDetails = result.map((detail) => {
            const detailData = detail.toJSON ? detail.toJSON() : detail;

            // Extract scales from scaleAssignments
            if (
              detailData.scaleAssignments &&
              detailData.scaleAssignments.length > 0
            ) {
              detailData.scales = detailData.scaleAssignments
                .map((assignment) => {
                  if (!assignment.scale) return null;

                  const scaleData = assignment.scale.toJSON
                    ? assignment.scale.toJSON()
                    : assignment.scale;

                  // Convert enum values from database to GraphQL enum format
                  if (scaleData.uom != null) {
                    scaleData.uom =
                      UOM_MAP[String(scaleData.uom).toLowerCase()] ||
                      scaleData.uom.toUpperCase();
                  }
                  if (scaleData.status != null) {
                    scaleData.status =
                      STATUS_MAP[String(scaleData.status).toLowerCase()] ||
                      scaleData.status.toUpperCase();
                  }

                  return scaleData;
                })
                .filter((scale) => scale !== null);
            } else {
              detailData.scales = [];
            }

            // Remove scaleAssignments from response as we only need scales
            delete detailData.scaleAssignments;

            return detailData;
          });

          return {
            productionOrderDetails: productionOrderDetails,
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

    productionOrderDetailDetail: combineResolvers(
      isAuthenticated,
      // hasPermission('productionOrderDetail.read'),
      async (_, { id }) => {
        try {
          const productionOrderDetail = await ProductionOrderDetail.findByPk(
            id,
            {
              include: [
                {
                  model: ProductionOrderSAP,
                  as: 'productionOrderSAP',
                  required: false,
                  attributes: [
                    'id',
                    'productionOrderNumber',
                    'plantCode',
                    'orderTypeCode',
                    'materialCode',
                    'targetWeight',
                    'productionDate',
                    'suitability',
                    'status',
                    'createdAt',
                  ],
                },
                {
                  model: OrderType,
                  as: 'orderType',
                  required: false,
                },
                {
                  model: ScaleAssignment,
                  as: 'scaleAssignments',
                  required: false,
                  where: {
                    deletedAt: null,
                  },
                  include: [
                    {
                      model: Scale,
                      as: 'scale',
                      required: false,
                    },
                  ],
                },
              ],
            }
          );

          if (!productionOrderDetail) {
            throw new ApolloError(
              'ProductionOrderDetail not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          await attachMaterialToDetails(productionOrderDetail);

          // Extract scales from scaleAssignments and convert enum values
          const detailData = productionOrderDetail.toJSON();

          if (
            detailData.scaleAssignments &&
            detailData.scaleAssignments.length > 0
          ) {
            detailData.scales = detailData.scaleAssignments
              .map((assignment) => {
                if (!assignment.scale) return null;

                const scaleData = assignment.scale.toJSON
                  ? assignment.scale.toJSON()
                  : assignment.scale;

                // Convert enum values from database to GraphQL enum format
                if (scaleData.uom != null) {
                  scaleData.uom =
                    UOM_MAP[String(scaleData.uom).toLowerCase()] ||
                    scaleData.uom.toUpperCase();
                }
                if (scaleData.status != null) {
                  scaleData.status =
                    STATUS_MAP[String(scaleData.status).toLowerCase()] ||
                    scaleData.status.toUpperCase();
                }

                return scaleData;
              })
              .filter((scale) => scale !== null);
          } else {
            detailData.scales = [];
          }

          // Remove scaleAssignments from response as we only need scales
          delete detailData.scaleAssignments;

          return detailData;
        } catch (err) {
          throw err;
        }
      }
    ),

    productionOrderDetailListByProductionOrder: combineResolvers(
      isAuthenticated,
      // hasPermission('productionOrderDetail.read'),
      pageMinCheckAndPageSizeMax,
      async (
        _,
        {
          productionOrderId,
          page = 0,
          pageSize = 10,
          sort = { columnName: 'createdAt', sortOrder: 'ASC' },
        }
      ) => {
        try {
          const whereClause = {
            productionOrderId: productionOrderId,
          };

          const countResult = await ProductionOrderDetail.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await ProductionOrderDetail.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
            include: [
              {
                model: ProductionOrderSAP,
                as: 'productionOrderSAP',
                attributes: [
                  'id',
                  'productionOrderNumber',
                  'plantCode',
                  'orderTypeCode',
                  'materialCode',
                  'targetWeight',
                  'productionDate',
                  'suitability',
                  'status',
                  'createdAt',
                ],
                required: false,
              },
              {
                model: OrderType,
                as: 'orderType',
                required: false,
                attributes: ['id', 'code', 'name', 'processType', 'maxDay'],
              },
            ],
          });

          await attachMaterialToDetails(result);

          return {
            productionOrderDetails: result,
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

    productionOrderDetailListByScaleIP: combineResolvers(
      isAuthenticated,
      // hasPermission('productionOrderDetail.read'),
      pageMinCheckAndPageSizeMax,
      async (
        _,
        {
          deviceIP,
          page = 0,
          pageSize = 10,
          sort = { columnName: 'createdAt', sortOrder: 'DESC' },
        }
      ) => {
        try {
          // First, find the Scale by deviceIP
          const scale = await Scale.findOne({
            where: {
              deviceIP: deviceIP,
            },
          });

          if (!scale) {
            return {
              productionOrderDetails: [],
              meta: {
                totalItems: 0,
                pageSize,
                currentPage: page,
                totalPages: 0,
              },
            };
          }

          // Find ScaleAssignments for this scale
          const scaleAssignments = await ScaleAssignment.findAll({
            where: {
              scaleId: scale.id,
            },
            attributes: ['productionOrderDetailId'],
          });

          const productionOrderDetailIds = scaleAssignments.map(
            (sa) => sa.productionOrderDetailId
          );

          if (productionOrderDetailIds.length === 0) {
            return {
              productionOrderDetails: [],
              meta: {
                totalItems: 0,
                pageSize,
                currentPage: page,
                totalPages: 0,
              },
            };
          }

          const whereClause = {
            id: { [Sequelize.Op.in]: productionOrderDetailIds },
          };

          const countResult = await ProductionOrderDetail.count({
            where: whereClause,
            distinct: true,
            col: 'id',
          });

          const result = await ProductionOrderDetail.findAll({
            where: whereClause,
            order: [[sort.columnName, sort.sortOrder]],
            limit: pageSize,
            offset: page * pageSize,
            include: [
              {
                model: ProductionOrderSAP,
                as: 'productionOrderSAP',
                attributes: [
                  'id',
                  'productionOrderNumber',
                  'plantCode',
                  'orderTypeCode',
                  'materialCode',
                  'targetWeight',
                  'productionDate',
                  'suitability',
                  'status',
                  'createdAt',
                ],
                required: false,
              },
              {
                model: OrderType,
                as: 'orderType',
                required: false,
                attributes: ['id', 'code', 'name', 'processType', 'maxDay'],
              },
            ],
          });

          await attachMaterialToDetails(result);

          return {
            productionOrderDetails: result,
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
  },

  Mutation: {
    productionOrderDetailCreate: combineResolvers(
      isAuthenticated,
      // hasPermission('productionOrderDetail.create'),
      async (_, { input }, { user }) => {
        validateInput(validationSchemas.productionOrderDetailCreate, input);
        const transaction = await ProductionOrderDetail.sequelize.transaction();

        try {
          // Validate productionOrderSAP exists
          const productionOrderSAP = await ProductionOrderSAP.findByPk(
            input.productionOrderId
          );

          if (!productionOrderSAP) {
            throw new ApolloError(
              'Production Order SAP not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // Fetch material from WMS by material code to validate and get UOM
          const material = await Material.findOne({
            where: {
              code: input.materialCode,
              clientId: 1000009,
            },
            include: [
              {
                model: MaterialUom,
                as: 'uom',
                attributes: ['id', 'clientId', 'code', 'name'],
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

          // Get orderTypeId from orderTypeCode in productionOrderSAP
          // Take only last 2 characters from orderTypeCode
          let orderTypeId = null;
          let processingType = null;
          if (productionOrderSAP.orderTypeCode) {
            const orderTypeCode = productionOrderSAP.orderTypeCode;
            const lastTwoChars =
              orderTypeCode.length >= 2
                ? orderTypeCode.slice(-2)
                : orderTypeCode;

            const orderType = await OrderType.findOne({
              where: {
                code: lastTwoChars,
              },
              attributes: ['id', 'code', 'name', 'processType', 'maxDay'],
            });

            if (orderType) {
              orderTypeId = orderType.id;
              processingType = orderType.processType;
            }
          }

          const payload = {
            productionOrderId: input.productionOrderId,
            materialCode: input.materialCode,
            materialDescription: material?.name,
            materialUom: material?.uom?.code,
            targetWeight: input.targetWeight,
            processingType: processingType,
            orderTypeId: orderTypeId,
            totalWeighed: input.totalWeighed ?? 0,
            totalWeighedGoodReceive: input.totalWeighedGoodReceive ?? 0,
            weighingCount: input.weighingCount ?? 0,
            createdBy: user?.id || null,
          };

          const newProductionOrderDetail = await ProductionOrderDetail.create(
            payload,
            {
              transaction,
            }
          );

          await transaction.commit();
          return newProductionOrderDetail;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    productionOrderDetailUpdate: combineResolvers(
      isAuthenticated,
      // hasPermission('productionOrderDetail.update'),
      async (_, { id, input }, { user }) => {
        validateInput(validationSchemas.productionOrderDetailUpdate, input);

        const transaction = await ProductionOrderDetail.sequelize.transaction();

        try {
          const productionOrderDetail = await ProductionOrderDetail.findByPk(
            id
          );

          if (!productionOrderDetail) {
            throw new ApolloError(
              'Production Order Detail not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          // If materialCode is being updated, validate it exists in WMS
          if (input.materialCode) {
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

            // Auto-update description and UOM from material if materialCode changed
            input.materialDescription = material?.name || input.materialCode;
            input.materialUom = material?.uom?.code || 'KG';
          }

          // Validate orderTypeId if provided
          if (input.orderTypeId !== undefined) {
            if (input.orderTypeId === null) {
              // Allow setting to null
              input.orderTypeId = null;
            } else {
              const orderType = await OrderType.findByPk(input.orderTypeId, {
                attributes: ['id', 'code', 'name', 'processType', 'maxDay'],
              });
              if (!orderType) {
                throw new ApolloError(
                  'Order Type not found',
                  apolloErrorCodes.NOT_FOUND
                );
              }
            }
          }

          const updatePayload = {
            ...input,
            updatedBy: user?.id || null,
          };

          await productionOrderDetail.update(updatePayload, {
            transaction,
          });

          await transaction.commit();
          return productionOrderDetail;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    productionOrderDetailUpdateTotalWeighed: combineResolvers(
      isAuthenticated,
      // hasPermission('productionOrderDetail.update'),
      async (
        _,
        { id, totalWeighed, totalWeighedGoodReceive, weighingCount },
        { user }
      ) => {
        validateInput(
          validationSchemas.productionOrderDetailUpdateTotalWeighed,
          {
            id,
            totalWeighed,
            totalWeighedGoodReceive,
            weighingCount,
          }
        );

        const transaction = await ProductionOrderDetail.sequelize.transaction();

        try {
          const productionOrderDetail = await ProductionOrderDetail.findByPk(
            id
          );

          if (!productionOrderDetail) {
            throw new ApolloError(
              'Production Order Detail not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          const updatePayload = {
            totalWeighed,
            updatedBy: user?.id || null,
          };

          if (totalWeighedGoodReceive !== undefined) {
            updatePayload.totalWeighedGoodReceive = totalWeighedGoodReceive;
          }

          if (weighingCount !== undefined) {
            updatePayload.weighingCount = weighingCount;
          } else {
            // Auto increment if not provided
            updatePayload.weighingCount =
              (productionOrderDetail.weighingCount || 0) + 1;
          }

          await productionOrderDetail.update(updatePayload, {
            transaction,
          });

          await transaction.commit();
          return productionOrderDetail;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),

    productionOrderDetailDelete: combineResolvers(
      isAuthenticated,
      // hasPermission('productionOrderDetail.delete'),
      async (_, { id }) => {
        const transaction = await ProductionOrderDetail.sequelize.transaction();

        try {
          const productionOrderDetail = await ProductionOrderDetail.findByPk(
            id
          );

          if (!productionOrderDetail) {
            throw new ApolloError(
              'Production Order Detail not found',
              apolloErrorCodes.NOT_FOUND
            );
          }

          await productionOrderDetail.destroy({ transaction });

          await transaction.commit();
          return true;
        } catch (err) {
          await transaction.rollback();
          throw err;
        }
      }
    ),
  },

  // Field resolvers
  ProductionOrderDetail: {
    material: async (productionOrderDetail) => {
      try {
        // If material is already attached (from attachMaterialToDetails), return it
        if (productionOrderDetail.material) {
          return productionOrderDetail.material;
        }

        // Otherwise, fetch from database
        if (!productionOrderDetail.materialCode) {
          return null;
        }

        const material = await Material.findOne({
          where: {
            code: productionOrderDetail.materialCode,
            clientId: MATERIAL_CLIENT_ID,
          },
          include: [
            {
              model: MaterialUom,
              as: 'uom',
              required: false,
              attributes: ['id', 'clientId', 'code', 'name'],
            },
          ],
        });

        return material ? material.toJSON() : null;
      } catch (error) {
        console.error(
          'Error fetching material for ProductionOrderDetail:',
          error
        );
        return null;
      }
    },
    scales: async (productionOrderDetail) => {
      try {
        // If scales are already attached (from productionOrderDetailList), return them
        if (productionOrderDetail.scales) {
          return productionOrderDetail.scales;
        }

        // Otherwise, fetch from database through ScaleAssignment
        const scaleAssignments = await ScaleAssignment.findAll({
          where: {
            productionOrderDetailId: productionOrderDetail.id,
            deletedAt: null,
          },
          include: [
            {
              model: Scale,
              as: 'scale',
              required: false,
            },
          ],
        });

        if (!scaleAssignments || scaleAssignments.length === 0) {
          return [];
        }

        // Extract scales and convert enum values
        const scales = scaleAssignments
          .map((assignment) => {
            if (!assignment.scale) return null;

            const scaleData = assignment.scale.toJSON
              ? assignment.scale.toJSON()
              : assignment.scale;

            // Convert enum values from database to GraphQL enum format
            if (scaleData.uom != null) {
              scaleData.uom =
                UOM_MAP[String(scaleData.uom).toLowerCase()] ||
                scaleData.uom.toUpperCase();
            }
            if (scaleData.status != null) {
              scaleData.status =
                STATUS_MAP[String(scaleData.status).toLowerCase()] ||
                scaleData.status.toUpperCase();
            }

            return scaleData;
          })
          .filter((scale) => scale !== null);

        return scales;
      } catch (error) {
        console.error(
          'Error fetching scales for ProductionOrderDetail:',
          error
        );
        return [];
      }
    },
  },
};
