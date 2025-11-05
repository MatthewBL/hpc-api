// docs/swagger.js
const swaggerJSDoc = require('swagger-jsdoc');
const packageJson = require('../package.json');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: packageJson.name || 'hpc-api',
      version: packageJson.version || '0.0.0',
      description: packageJson.description || 'HPC API',
    },
    servers: [
      {
        url: 'http://localhost:3000', // adjust default if your app uses another port
      },
    ],
  },
  // Paths to files containing OpenAPI definitions (JSDoc comments)
  apis: [
    './routes/*.js',
    // add other patterns if you annotate services or models:
    // './services/*.js',
  ],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;