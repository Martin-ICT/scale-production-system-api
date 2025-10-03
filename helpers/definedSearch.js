const Sequelize = require('sequelize');
const { Op } = Sequelize;

module.exports = (search) => {
  if (!search || !search.query || !Array.isArray(search.inColumns) || search.inColumns.length === 0) {
    return {};
  }

  const whereClause = {
    [Op.or]: search.inColumns.map((colName) => ({
      [colName]: {
        [Op.iLike]: `%${search.query}%`, // Use Op.iLike for case-insensitive matching
      },
    })),
  };

  return whereClause;
};
