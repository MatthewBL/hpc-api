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
 *     summary: Start a new Slurm job
 *     tags:
 *       - Jobs
 *     description: |
 *       Submits a job request to the Slurm service for the requested GPU type.
 *       The request body is forwarded to the Slurm service and is implementation-specific
 *       (e.g., may include model, port, timeout, environment variables, etc.).
 *     parameters:
 *       - in: path
 *         name: gpuType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [a30, a40, a100]
 *         description: GPU type to request (a30, a40, or a100)
 *     requestBody:
 *       description: Job submission parameters
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - model
 *               - port
 *               - gpus
 *               - cpus
 *               - period
 *               - node
 *             properties:
 *               model:
 *                 type: string
 *                 example: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B"
 *                 description: The model identifier to run
 *               port:
 *                 type: integer
 *                 example: 9000
 *                 description: Port number for the service
 *               gpus:
 *                 type: integer
 *                 example: 4
 *                 description: Number of GPUs to allocate
 *               cpus:
 *                 type: integer
 *                 example: 4
 *                 description: Number of CPUs to allocate
 *               period:
 *                 type: string
 *                 example: "01:00:00"
 *                 description: Time period for the job (HH:MM:SS format)
 *               node:
 *                 type: string
 *                 example: "gpu02"
 *                 description: Specific node to run the job on
 *     responses:
 *       '200':
 *         description: Job started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 jobId:
 *                   type: string
 *                   example: '12345'
 *                 gpuNode:
 *                   type: string
 *                   example: 'gpu02'
 *                 message:
 *                   type: string
 *                   example: 'Job started successfully'
 *       '400':
 *         description: Bad request (invalid gpuType or payload)
 *       '500':
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

// Register an externally-started SLURM job
/**
 * @openapi
 * /api/jobs/register:
 *   post:
 *     summary: Register an externally-started Slurm job
 *     tags:
 *       - Jobs
 *     description: |
 *       Register a job that was started outside this API so it becomes available
 *       for query routing. The client must supply a job id and connection info.
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
 *                 description: The Slurm job id
 *                 example: '12345'
 *               port:
 *                 type: integer
 *                 description: Port number for the service
 *                 example: 9000
 *               model:
 *                 type: string
 *                 description: The model identifier to run
 *                 example: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B"
 *               node:
 *                 type: string
 *                 description: The compute node where the job is running
 *                 example: "gpu02"
 *               gpuType:
 *                 type: string
 *                 description: The GPU type used by the job
 *                 example: "a30"
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: The job start time
 *     responses:
 *       '201':
 *         description: Job registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 job:
 *                   type: object
 *                   properties:
 *                     port:
 *                       type: integer
 *                       example: 9000
 *                     model:
 *                       type: string
 *                       example: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B'
 *                     node:
 *                       type: string
 *                       example: 'gpu02'
 *                     gpuType:
 *                       type: string
 *                       example: 'a30'
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                       example: '2024-06-15T12:34:56.789Z'
 *                     _id:
 *                       type: string
 *                       example: 'temp_Ab1'
 *       '400':
 *         description: Bad request (missing/invalid fields)
 *       '500':
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

// Get active jobs available for queries
/**
 * @openapi
 * /api/jobs:
 *   get:
 *     summary: List active jobs available for LLM queries
 *     tags:
 *       - Jobs
 *     description: |
 *       Returns jobs that have been registered with this API (either created via this
 *       service or registered externally). Each returned job includes connection info
 *       and inferred runtime status (available / setting up / unknown).
 *     responses:
 *       '200':
 *         description: Active jobs and their availability
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                   example: 1
 *                 jobs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       jobId:
 *                         type: string
 *                         example: '12345'
 *                       port:
 *                         type: integer
 *                         example: 9000
 *                       model:
 *                         type: string
 *                         example: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B'
 *                       node:
 *                         type: string
 *                         example: 'gpu02'
 *                       gpuType:
 *                         type: string
 *                         example: 'a30'
 *                       startTime:
 *                         type: string
 *                         format: date-time
 *                         example: '2024-06-15T12:34:56.789Z'
 *                       _id:
 *                         type: string
 *                         example: '12345'
 *                       status:
 *                         type: string
 *                         description: availability status for query routing
 *                         example: 'available'
 *                       period:
 *                         type: string
 *                         example: '01:00:00'
 *                       time:
 *                         type: string
 *                         example: '00:15:23'
 *                       timeLeft:
 *                         type: string
 *                         example: '00:44:37'
 *       '500':
 *         description: Internal server error
 */
router.get('/', async (req, res) => {
  try {
    // Load persisted jobs from jobStore
    let activeJobs = await jobStore.getAll();

    // Reconcile registered active jobs with the current Slurm queue.
    // Remove any jobs from the registry that are no longer present in squeue.
    let slurmResult = null;
    try {
      slurmResult = await slurmService.getJobStatus();
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
    // Also merge Slurm timing info (period/time/timeLeft) when available.
    const checks = activeJobs.map(async (job) => {
      const jobLog = path.join(__dirname, '..', `slurm-${job._id}.out`);
      try {
        // If file is large this reads whole file; acceptable for typical slurm logs here.
        const content = await fs.promises.readFile(jobLog, 'utf8');
        const started = content.includes('INFO:     Application startup complete.');
        // Attach slurm timing fields if we were able to fetch them earlier
        let slurmInfo = {};
        try {
          if (slurmResult && slurmResult.success && Array.isArray(slurmResult.jobs)) {
            const found = slurmResult.jobs.find(j => String(j.id) === String(job._id));
            if (found) {
              slurmInfo = {
                period: found.period, // time limit
                time: found.time, // elapsed
                timeLeft: found.timeLeft
              };
            }
          }
        } catch (mergeErr) {
          // ignore merge errors and continue
        }

        return {
          jobId: job._id,
          ...job,
          status: started ? 'available' : 'setting up',
          ...slurmInfo
        };
      } catch (err) {
        // If file does not exist or can't be read, treat as still setting up
        if (err.code === 'ENOENT') {
          let slurmInfo = {};
          try {
            if (slurmResult && slurmResult.success && Array.isArray(slurmResult.jobs)) {
              const found = slurmResult.jobs.find(j => String(j.id) === String(job._id));
              if (found) {
                slurmInfo = {
                  period: found.period,
                  time: found.time,
                  timeLeft: found.timeLeft
                };
              }
            }
          } catch (mergeErr) {
            // ignore
          }

          return {
            jobId: job._id,
            ...job,
            status: 'setting up',
            logMissing: true,
            ...slurmInfo
          };
        }
        // Other errors are surfaced but do not crash the entire response
        let slurmInfo = {};
        try {
          if (slurmResult && slurmResult.success && Array.isArray(slurmResult.jobs)) {
            const found = slurmResult.jobs.find(j => String(j.id) === String(job._id));
            if (found) {
              slurmInfo = {
                period: found.period,
                time: found.time,
                timeLeft: found.timeLeft
              };
            }
          }
        } catch (mergeErr) {
          // ignore
        }

        return {
          jobId: job._id,
          ...job,
          status: 'unknown',
          error: err.message,
          ...slurmInfo
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

// Get a single active job by jobId
/**
 * @openapi
 * /api/jobs/{jobId}:
 *   get:
 *     summary: Retrieve a registered job
 *     tags:
 *       - Jobs
 *     description: Returns the stored job record and merged Slurm timing/status fields
 *       when available. The response also inspects the Slurm log to determine whether
 *       the application has finished startup and is available for queries.
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: The job id to fetch
 *     responses:
 *       '200':
 *         description: Job details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 job:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                       example: '12345'
 *                     port:
 *                       type: integer
 *                       example: 9000
 *                     model:
 *                       type: string
 *                       example: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B'
 *                     node:
 *                       type: string
 *                       example: 'gpu02'
 *                     gpuType:
 *                       type: string
 *                       example: 'a30'
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                       example: '2024-06-15T12:34:56.789Z'
 *                     status:
 *                       type: string
 *                       example: 'available'
 *                     period:
 *                       type: string
 *                       example: '01:00:00'
 *                     time:
 *                       type: string
 *                       example: '00:15:23'
 *                     timeLeft:
 *                       type: string
 *                       example: '00:44:37'
 *                     name:
 *                       type: string
 *                       example: 'temp_11abCD.slurm'
 *       '404':
 *         description: Job not found
 *       '500':
 *         description: Internal server error
 */
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    // Find persisted job
    const job = await jobStore.findJob(String(jobId));
    if (!job) return respond.error(res, `Job ${jobId} not found`, 404);

    // Fetch Slurm info to merge timing fields when available
    let slurmResult = null;
    try {
      slurmResult = await slurmService.getJobStatus();
    } catch (err) {
      // non-fatal
    }

    let slurmInfo = {};
    try {
      if (slurmResult && slurmResult.success && Array.isArray(slurmResult.jobs)) {
        const found = slurmResult.jobs.find(j => String(j.id) === String(jobId));
        if (found) {
          slurmInfo = {
            period: found.period,
            time: found.time,
            timeLeft: found.timeLeft,
            node: found.node,
            name: found.name
          };
        }
      }
    } catch (mergeErr) {
      // ignore
    }

    // Check slurm log for startup marker
    const jobLog = path.join(__dirname, '..', `slurm-${jobId}.out`);
    try {
      const content = await fs.promises.readFile(jobLog, 'utf8');
      const started = content.includes('INFO:     Application startup complete.');
      const status = started ? 'available' : 'setting up';

      return respond.success(res, {
        job: {
          jobId: String(jobId),
          ...job,
          status,
          ...slurmInfo
        }
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return respond.success(res, {
          job: {
            jobId: String(jobId),
            ...job,
            status: 'setting up',
            logMissing: true,
            ...slurmInfo
          }
        });
      }

      return respond.success(res, {
        job: {
          jobId: String(jobId),
          ...job,
          status: 'unknown',
          error: err.message,
          ...slurmInfo
        }
      });
    }
  } catch (error) {
    return respond.error(res, error.message || 'Failed to get job', 500);
  }
});

// Cancel a job
/**
 * @openapi
 * /api/jobs/{jobId}:
 *   delete:
 *     summary: Cancel (terminate) a job
 *     tags:
 *       - Jobs
 *     description: Requests cancellation of the specified Slurm job. If the job is not
 *       found the endpoint returns 404.
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: The Slurm job id to cancel
 *     responses:
 *       '200':
 *         description: Cancellation accepted (job canceled or request queued)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: 'Job cancelled successfully'
 *       '404':
 *         description: Job not found
 *       '500':
 *         description: Internal server error
 */
router.delete('/:jobId', async (req, res) => {
  try {
    const result = await slurmService.cancelJob(req.params.jobId);
    if (result.success) return respond.success(res, result);
    // If the service signals the job wasn't found, return 404 to the client
    if (result && result.code === 404) {
      return respond.error(res, result.error || 'Job not found', 404, result);
    }
    return respond.error(res, result.error || 'Failed to cancel job', 500, result);
  } catch (error) {
    return respond.error(res, error.message || 'Failed to cancel job', 500);
  }
});

module.exports = router;