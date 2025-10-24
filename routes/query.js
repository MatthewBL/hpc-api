// routes/query.js
const express = require('express');
const llmQueryService = require('../services/llmQueryService');
const router = express.Router();

// Send query to a specific job or first available
router.post('/', async (req, res) => {
  try {
    const { 
      messages, 
      jobId, 
      model, 
      temperature = 0, 
      seed = 41008, 
      logprobs = true,
      max_tokens = null,
      timeout = 30000
    } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required'
      });
    }

    const result = await llmQueryService.sendQuery(jobId, messages, {
      model,
      temperature,
      seed,
      logprobs,
      max_tokens,
      timeout
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Send query to a specific job by ID
router.post('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { 
      messages, 
      model, 
      temperature = 0, 
      seed = 41008, 
      logprobs = true,
      max_tokens = null,
      timeout = 30000
    } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required'
      });
    }

    const result = await llmQueryService.sendQuery(jobId, messages, {
      model,
      temperature,
      seed,
      logprobs,
      max_tokens,
      timeout
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;