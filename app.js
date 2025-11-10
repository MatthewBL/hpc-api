const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Import routes correctly
const jobRoutes = require('./routes/jobs');
const healthRoutes = require('./routes/health');

// Use routes - make sure these are actually router objects
app.use('/api/jobs', jobRoutes);
app.use('/health', healthRoutes);

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./docs/swagger');

// Serve API docs (optionally only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`HPC API running on port ${PORT}`);
});