// routes/jobs.js
const express = require('express');
const slurmService = require('../services/slurmService');
const router = express.Router();

// ✅ Correct routes - no duplicate prefix
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

router.get('/', async (req, res) => {
  try {
    const result = await slurmService.getJobStatus();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:jobId', async (req, res) => {
  try {
    const result = await slurmService.cancelJob(req.params.jobId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;