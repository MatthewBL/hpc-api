const express = require('express');
const slurmService = require('../services/slurmService');
const llmQueryService = require('../services/llmQueryService'); // Add this import
const router = express.Router();

// Start a new job
router.post('/start/:gpuType', async (req, res) => {
  try {
    const { gpuType } = req.params;
    const result = await slurmService.startJob(gpuType, req.body);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all jobs (Slurm status)
router.get('/', async (req, res) => {
  try {
    const result = await slurmService.getJobStatus();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active jobs available for queries
router.get('/active', (req, res) => {
  try {
    const activeJobs = llmQueryService.getActiveJobs();
    res.json({
      success: true,
      count: activeJobs.length,
      jobs: activeJobs
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Cancel a job
router.delete('/:jobId', async (req, res) => {
  try {
    const result = await slurmService.cancelJob(req.params.jobId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;