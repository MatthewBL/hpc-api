// docs/swagger.js
const swaggerJSDoc = require('swagger-jsdoc');
const packageJson = require('../package.json');

const modelsPaths = require('./models.paths');

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
        url: `http://localhost:${process.env.REMOTE_PORT || 3000}`,
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

// Merge explicit ordered model paths first so they appear in desired order
swaggerSpec.paths = Object.assign({}, modelsPaths, swaggerSpec.paths || {});

module.exports = swaggerSpec;