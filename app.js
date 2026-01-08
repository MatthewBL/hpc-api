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

// Expose selected env vars to the client
app.get('/env.js', (req, res) => {
  const payload = {
    LOCAL_PORT: process.env.LOCAL_PORT || ''
  };
  res.type('application/javascript').send(`window.__ENV__ = ${JSON.stringify(payload)};`);
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Expose node_configuration.json for download
app.get('/node_configuration.json', (req, res) => {
  const filePath = path.join(__dirname, 'node_configuration.json');
  res.sendFile(filePath);
});

// Import routes correctly
const healthRoutes = require('./routes/health');
const modelRoutes = require('./routes/models');
const jobRoutes = require('./routes/jobs');
const researcherRoutes = require('./routes/researchers');
const slaRoutes = require('./routes/slas');

// Use routes - make sure these are actually router objects
app.use('/health', healthRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/researchers', researcherRoutes);
app.use('/api/slas', slaRoutes);

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