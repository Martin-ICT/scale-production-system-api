const Sequelize = require('sequelize');

const { Op } = Sequelize;
module.exports = (dateFilter) => {
  let date;
  if (dateFilter.startDate && !dateFilter.endDate) {
    date = { [Op.gte]: dateFilter.startDate };
  } else if (dateFilter.endDate && !dateFilter.startDate) {
    date = { [Op.lte]: dateFilter.endDate };
  } else if (dateFilter.startDate && dateFilter.endDate) {
    date = {
      [Op.and]: [{ [Op.lte]: dateFilter.endDate }, { [Op.gte]: dateFilter.startDate }],
    };
  }
  return date;
};
