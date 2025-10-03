const { UserInputError } = require('apollo-server');

const joiToForms = require('joi-errors-for-forms').form;

const convertToForms = joiToForms();

const joiErrorCallback = errs => {
  if (errs) {
    throw new UserInputError(
      'Failed to run function due to validation errors',
      {
        validationErrors: convertToForms(errs)
      }
    );
  }
};

module.exports = { joiErrorCallback };
