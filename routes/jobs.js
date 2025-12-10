const express = require('express');
const respond = require('../utils/response');
const jobStore = require('../services/jobStore');
const jobHistoryStore = require('../services/jobHistoryStore');

const router = express.Router();

/**
 * POST /api/jobs/register - register a job from shell script
 * 
 * This endpoint is called by the shell scripts (vllm_serve_run_*.sh) to register
 * a newly submitted SLURM job. This ensures we have the correct job ID from sbatch
 * instead of trying to query squeue (which has race conditions with multiple jobs).
 *
 * @openapi
 * /api/jobs/register:
 *   post:
 *     summary: Register a job that was submitted via sbatch
 *     tags:
 *       - Jobs
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobId
 *               - port
 *               - model
 *             properties:
 *               jobId:
 *                 type: string
 *                 description: SLURM job ID from sbatch output
 *               port:
 *                 type: integer
 *               model:
 *                 type: string
 *               node:
 *                 type: string
 *               gpuType:
 *                 type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       '200':
 *         description: Job registered successfully
 *       '400':
 *         description: Missing required fields
 *       '500':
 *         description: Failed to register job
 */
router.post('/register', async (req, res) => {
  try {
    const { jobId, port, model, node, gpuType, startTime } = req.body || {};
    
    if (!jobId || !port || !model) {
      return respond.error(res, 'Missing required fields: jobId, port, model', 400);
    }

    const jobInfo = {
      port: Number(port),
      model: String(model),
      node: node || '',
      gpuType: gpuType || '',
      startTime: startTime || new Date().toISOString()
    };

    try {
      await jobStore.addJob(String(jobId), jobInfo);
    } catch (err) {
      console.warn('Failed to persist job:', err.message || err);
      return respond.error(res, 'Failed to persist job', 500);
    }

    // Also record in job history
    try {
      await jobHistoryStore.addJob(String(jobId), {
        modelId: String(model),
        status: 'ongoing',
        config: {
          port: Number(port),
          node: node || '',
          gpuType: gpuType || ''
        },
        startTime: jobInfo.startTime
      });
    } catch (err) {
      console.warn('Failed to record job in history:', err.message || err);
    }

    return respond.success(res, { message: 'Job registered successfully', jobId });
  } catch (error) {
    return respond.error(res, error.message || 'Failed to register job', 500);
  }
});

module.exports = router;
