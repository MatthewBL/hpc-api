const express = require('express');
const slurmService = require('../services/slurmService');
const jobStore = require('../services/jobStore');
const fs = require('fs');
const path = require('path');
const respond = require('../utils/response');
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
      return respond.success(res, result);
    }
    return respond.error(res, result.error || 'Failed to start job', 500, result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all jobs (Slurm status)
/**
 * @openapi
 * /api/jobs/all:
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
router.get('/all', async (req, res) => {
  try {
  const result = await slurmService.getJobStatus();
  return respond.success(res, result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active jobs available for queries
/**
 * @openapi
 * /api/jobs/:
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
router.get('/', async (req, res) => {
  try {
    // Load persisted jobs from jobStore
    let activeJobs = await jobStore.getAll();

    // Reconcile registered active jobs with the current Slurm queue.
    // Remove any jobs from the registry that are no longer present in squeue.
    try {
      const slurmResult = await slurmService.getJobStatus();
      if (slurmResult && slurmResult.success && Array.isArray(slurmResult.jobs)) {
        const currentIds = new Set(slurmResult.jobs.map(j => String(j.id)));
        // Remove jobs that are no longer in Slurm from the persistent store
        for (const doc of activeJobs) {
          if (!currentIds.has(String(doc._id))) {
            try {
              await jobStore.removeJob(doc._id);
            } catch (err) {
              console.warn(`Failed to remove stale job ${doc._id}:`, err.message || err);
            }
          }
        }
        // Refresh list
        activeJobs = await jobStore.getAll();
      }
      // If slurmResult.success is false, we skip pruning and continue
    } catch (pruneErr) {
      // Non-fatal: log server-side but continue returning whatever is registered
      console.warn('Failed to reconcile active jobs with Slurm:', pruneErr.message || pruneErr);
    }

    // For each active job, check corresponding slurm log for the startup string
    const checks = activeJobs.map(async (job) => {
      const jobLog = path.join(__dirname, '..', `slurm-${job._id}.out`);
      try {
        // If file is large this reads whole file; acceptable for typical slurm logs here.
        const content = await fs.promises.readFile(jobLog, 'utf8');
        const started = content.includes('INFO:     Application startup complete.');
        return {
          jobId: job._id,
          ...job,
          status: started ? 'available' : 'setting up'
        };
      } catch (err) {
        // If file does not exist or can't be read, treat as still setting up
        if (err.code === 'ENOENT') {
          return {
            jobId: job._id,
            ...job,
            status: 'setting up',
            logMissing: true
          };
        }
        // Other errors are surfaced but do not crash the entire response
        return {
          jobId: job._id,
          ...job,
          status: 'unknown',
          error: err.message
        };
      }
    });

    const jobsWithStatus = await Promise.all(checks);

    return respond.success(res, {
      count: jobsWithStatus.length,
      jobs: jobsWithStatus
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
    if (result.success) return respond.success(res, result);
    return respond.error(res, result.error || 'Failed to cancel job', 500, result);
  } catch (error) {
    return respond.error(res, error.message || 'Failed to cancel job', 500);
  }
});

// Register an externally-started SLURM job
/**
 * @openapi
 * /api/jobs/register:
 *   post:
 *     summary: Register an externally-started Slurm job
 *     tags:
 *       - Jobs
 *     description: |
 *       Registers a job that was started outside of this API (for example,
 *       a model started manually on the cluster). The caller must provide a
 *       jobId and at least basic connection info so the job becomes available
 *       for query routing.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobId
 *               - port
 *             properties:
 *               jobId:
 *                 type: string
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
 *       201:
 *         description: Job registered
 *       400:
 *         description: Bad request (missing/invalid fields)
 *       500:
 *         description: Internal server error
 */
router.post('/register', async (req, res) => {
  try {
    const { jobId, port, model = '', node = '', gpuType = '', startTime = new Date().toISOString() } = req.body || {};

    if (!jobId || !port) {
      return respond.error(res, 'Missing required fields: jobId and port', 400);
    }

    // Basic validation
    if (typeof jobId !== 'string') {
      return respond.error(res, 'jobId must be a string', 400);
    }
    const portNum = Number(port);
    if (!Number.isInteger(portNum) || portNum <= 0) {
      return respond.error(res, 'port must be a positive integer', 400);
    }

    const jobInfo = {
      port: portNum,
      model,
      node,
      gpuType,
      startTime
    };

    try {
      const doc = await jobStore.addJob(jobId, jobInfo);
      return respond.created(res, { job: doc });
    } catch (err) {
      return respond.error(res, err.message || String(err), 500);
    }
  } catch (error) {
    return respond.error(res, error.message || 'Failed to register job', 500);
  }
});

module.exports = router;