const express = require('express');
const slurmService = require('../services/slurmService');
const llmQueryService = require('../services/llmQueryService'); // Add this import
const router = express.Router();

// Start a new job
/**
 * @openapi
 * /api/jobs/start/{gpuType}:
 *   post:
 *     summary: Start a new job (Slurm)
 *     tags:
 *       - Jobs
 *     description: |
 *       Starts a new Slurm job for the requested GPU type. 
 *       The body schema is implementation-specific and is forwarded to the Slurm service.
 *     parameters:
 *       - in: path
 *         name: gpuType
 *         required: true
 *         schema:
 *           type: string
 *         description: Type of GPU to request (a100, a40 or a30)
 *     responses:
 *       200:
 *         description: Job started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 jobId:
 *                   type: string
 *                 details:
 *                   type: object
 *                   description: Additional info returned by the Slurm service
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
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
/**
 * @openapi
 * /api/jobs:
 *   get:
 *     summary: Get all jobs (Slurm status)
 *     tags:
 *       - Jobs
 *     description: Returns the current status of jobs managed via Slurm.
 *     responses:
 *       200:
 *         description: Array of job statuses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 jobs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     description: Job status object as returned by the Slurm service
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req, res) => {
  try {
    const result = await slurmService.getJobStatus();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active jobs available for queries
/**
 * @openapi
 * /api/jobs/active:
 *   get:
 *     summary: Get active jobs available for LLM queries
 *     tags:
 *       - Jobs
 *     description: Returns the set of jobs currently registered as active and available
 *       for sending LLM queries. Each job object includes `jobId` and connection info.
 *     responses:
 *       200:
 *         description: Active jobs list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 jobs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       jobId:
 *                         type: string
 *                       port:
 *                         type: integer
 *                       model:
 *                         type: string
 *                       node:
 *                         type: string
 *       500:
 *         description: Internal server error
 */
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
/**
 * @openapi
 * /api/jobs/{jobId}:
 *   delete:
 *     summary: Cancel a job
 *     tags:
 *       - Jobs
 *     description: Cancels the Slurm job with the provided ID.
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job cancelled (or cancellation queued)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Job not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:jobId', async (req, res) => {
  try {
    const result = await slurmService.cancelJob(req.params.jobId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;