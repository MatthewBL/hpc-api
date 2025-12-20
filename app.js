const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Import routes correctly
const healthRoutes = require('./routes/health');
const modelRoutes = require('./routes/models');
const jobRoutes = require('./routes/jobs');

// Use routes - make sure these are actually router objects
app.use('/health', healthRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/jobs', jobRoutes);

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./docs/swagger');

// Serve API docs 
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.REMOTE_PORT || 3000;
app.listen(PORT, () => {
  console.log(`HPC API running on port ${PORT}`);
});