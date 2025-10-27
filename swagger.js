const swaggerJsDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Train Email API",
      version: "1.0.0",
      description: "A simple API to send emails to our recipients",
    },
  },
  apis: ["./*.js"],
};

const swaggerSpecs = swaggerJsDoc(options);

module.exports = swaggerSpecs;
