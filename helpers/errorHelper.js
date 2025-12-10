const { UserInputError } = require('apollo-server');

const joiToForms = require('joi-errors-for-forms').form;

const convertToForms = joiToForms();

const joiErrorCallback = errs => {
  if (errs) {
    const validationErrors = convertToForms(errs);
    
    // Create detailed error message from validation errors
    // Format: "field": "error message"
    const errorMessages = Object.entries(validationErrors)
      .map(([field, message]) => `"${field}": ${JSON.stringify(message)}`)
      .join(', ');
    
    // Use the detailed error messages as the main message
    const detailedMessage = errorMessages || 'Failed to run function due to validation errors';
    
    throw new UserInputError(detailedMessage, {
      validationErrors: validationErrors
    });
  }
};

module.exports = { joiErrorCallback };
