module.exports = async (parent, { page, pageSize }) => {
  if (page < 0) {
    throw Error('page value must be greater or equal zero');
  }
  if (pageSize > 30) {
    throw Error('page size maximum is 30');
  }
};
