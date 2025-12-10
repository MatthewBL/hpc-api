const express = require('express');
const path = require('path');
const fs = require('fs');
const respond = require('../utils/response');
const Model = require('../models/model');
const modelStore = require('../services/modelStore');
const jobStore = require('../services/jobStore');
const jobHistoryStore = require('../services/jobHistoryStore');
const slurmService = require('../services/slurmService');

const router = express.Router();

// Helpers
async function _findJobForModel(modelId) {
  const jobs = await jobStore.getAll();
  return jobs.find(j => String(j.model) === String(modelId)) || null;
}

function _formatElapsed(startIso) {
  if (!startIso) return null;
  try {
    const start = new Date(startIso);
    if (Number.isNaN(start.getTime())) return null;
    const now = new Date();
    let diff = Math.floor((now - start) / 1000); // seconds
    const hours = Math.floor(diff / 3600);
    diff %= 3600;
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    // Pad to HH:MM:SS (hours may exceed 24)
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  } catch (err) {
    return null;
  }
}

function _stateFromJob(job) {
  if (!job) return 'Stopped';
  // Check the slurm log for startup marker
  const jobLog = path.join(__dirname, '..', `slurm-${job._id}.out`);
  try {
    const content = fs.readFileSync(jobLog, 'utf8');
    const started = content.includes('INFO:     Application startup complete.');
    return started ? 'Running' : 'Setting up';
  } catch (err) {
    // If log missing treat as setting up
    return 'Setting up';
  }
}

// Map a node name to the GPU type used by our Makefile/cluster
function _gpuTypeFromNode(node) {
  if (!node) return 'a100';
  const n = String(node).toLowerCase();
  const a30 = new Set(['gpu01', 'gpu02']);
  const a40 = new Set(['gpu03', 'gpu04', 'gpu05', 'gpu06']);
  const a100 = new Set(['gpu07', 'gpu08']);
  if (a30.has(n)) return 'a30';
  if (a40.has(n)) return 'a40';
  if (a100.has(n)) return 'a100';
  return 'a100';
}

/**
 * GET /api/models - list all models with derived state
 *
 * @openapi
 * /api/models:
 *   get:
 *     summary: List stored models
 *     tags:
 *       - Models
 *     description: Returns all models persisted in the service with a derived `state` and `running` values.
 *     responses:
 *       '200':
 *         description: A list of models
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 models:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       huggingFaceName:
 *                         type: string
 *                       settings:
 *                         type: object
 *                       running:
 *                         type: object
 *                       state:
 *                         type: string
 *             examples:
 *               singleModel:
 *                 summary: Example response with one model
 *                 value:
 *                   success: true
 *                   count: 1
 *                   models:
 *                     - id: "deepseek_qwen_7B"
 *                       huggingFaceName: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B"
 *                       settings:
 *                          port: 9000
 *                          gpus: 4
 *                          cpus: 8
 *                          node: "gpu08"
 *                          period: "24:00:00"
 *                       running:
 *                          port: null
 *                          gpus: null
 *                          cpus: null
 *                          node: null
 *                          period: null
 *                       state: "Stopped"
 *                       _id: "deepseek_qwen_7B"
 */
router.get('/', async (req, res) => {
  try {
    const docs = await modelStore.getAll();

    const modelsWithState = await Promise.all(docs.map(async (doc) => {
      try {
        const job = await _findJobForModel(doc.id);
        const state = _stateFromJob(job);
        // Ensure running field exists on older documents
        const running = (doc.running && typeof doc.running === 'object') ? Object.assign({}, Model.defaultRunning(), doc.running) : Model.defaultRunning();
        // If a job exists, prefer job.startTime if available and compute elapsed time
        let runningNormalized = Model.defaultRunning();
        if (job) {
          runningNormalized = Object.assign({}, running);
          if (!runningNormalized.startTime && job.startTime) runningNormalized.startTime = job.startTime;
          runningNormalized.time = runningNormalized.startTime ? _formatElapsed(runningNormalized.startTime) : null;
        }
        return Object.assign({}, doc, { state, running: runningNormalized });
      } catch (innerErr) {
        return Object.assign({}, doc, { state: 'Unknown', error: innerErr.message, running: Model.defaultRunning() });
      }
    }));

    return respond.success(res, { count: modelsWithState.length, models: modelsWithState });
  } catch (error) {
    return respond.error(res, error.message || 'Failed to list models', 500);
  }
});

/**
 * GET /api/models/:id - get model info including derived state
 *
 * @openapi
 * /api/models/{id}:
 *   get:
 *     summary: Retrieve a model by id
 *     tags:
 *       - Models
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Model details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 model:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     huggingFaceName:
 *                       type: string
 *                     settings:
 *                       type: object
 *                     running:
 *                       type: object
 *                     state:
 *                       type: string
 *             examples:
 *               deepseek_qwen_7B:
 *                 summary: Example response with the deepseek_qwen_7B model
 *                 value:
 *                   success: true
 *                   models:
 *                     - id: "deepseek_qwen_7B"
 *                       huggingFaceName: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B"
 *                       settings:
 *                          port: 9000
 *                          gpus: 4
 *                          cpus: 8
 *                          node: "gpu08"
 *                          period: "24:00:00"
 *                       running:
 *                          port: null
 *                          gpus: null
 *                          cpus: null
 *                          node: null
 *                          period: null
 *                       state: "Stopped"
 *                       _id: "deepseek_qwen_7B"
 *       '404':
 *         description: Model not found
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await modelStore.findModel(id);
    if (!doc) return respond.error(res, `Model ${id} not found`, 404);

    const job = await _findJobForModel(doc.id);
    const state = _stateFromJob(job);
    const running = (doc.running && typeof doc.running === 'object') ? Object.assign({}, Model.defaultRunning(), doc.running) : Model.defaultRunning();
    const runningNormalized = job ? Object.assign({}, running, { startTime: running.startTime || job.startTime, time: (running.startTime || job.startTime) ? _formatElapsed(running.startTime || job.startTime) : null }) : Model.defaultRunning();

    return respond.success(res, { model: Object.assign({}, doc, { state, running: runningNormalized }) });
  } catch (error) {
    return respond.error(res, error.message || 'Failed to get model', 500);
  }
});

/**
 * GET /api/models/:id/state - get only the state (Stopped/Setting up/Running)
 *
 * @openapi
 * /api/models/{id}/state:
 *   get:
 *     summary: Retrieve only the state of a model
 *     tags:
 *       - Models
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Model state
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 state:
 *                   type: string
 *                 running:
 *                   type: object
 *             examples:
 *               deepseek_qwen_7B:
 *                 summary: Example response with the deepseek_qwen_7B model state
 *                 value:
 *                   success: true
 *                   state: "Running"
 *                   running:
 *                    port: 9000
 *                    gpus: 4
 *                    cpus: 4
 *                    node: "gpu04"
 *                    period: "01:00:00"
 *       '404':
 *         description: Model not found
 */
router.get('/:id/state', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await modelStore.findModel(id);
    if (!doc) return respond.error(res, `Model ${id} not found`, 404);

    const job = await _findJobForModel(doc.id);
    const state = _stateFromJob(job);
    const running = (doc.running && typeof doc.running === 'object') ? Object.assign({}, Model.defaultRunning(), doc.running) : Model.defaultRunning();
    const runningNormalized = job ? Object.assign({}, running, { startTime: running.startTime || job.startTime, time: (running.startTime || job.startTime) ? _formatElapsed(running.startTime || job.startTime) : null }) : Model.defaultRunning();
    return respond.success(res, { state, running: runningNormalized });
  } catch (error) {
    return respond.error(res, error.message || 'Failed to get model state', 500);
  }
});

/**
 * POST /api/models - create a new model
 *
 * @openapi
 * /api/models:
 *   post:
 *     summary: Create a new model record
 *     tags:
 *       - Models
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - huggingFaceName
 *             properties:
 *               id:
 *                 type: string
 *               huggingFaceName:
 *                 type: string
 *               settings:
 *                 type: object
 *               running:
 *                 type: object
 *               state:
 *                 type: string
 *           examples:
 *             createdModel:
 *               summary: Example body to create a model
 *               value:
 *                 id: "deepseek_qwen_7B"
 *                 huggingFaceName: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B"
 *             createdModelExtraParams:
 *               summary: Example body with extra parameters to create a model
 *               value:
 *                 id: "deepseek_qwen_7B"
 *                 huggingFaceName: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B"
 *                 settings:
 *                   port: 9000
 *                   gpus: 4
 *                   cpus: 4
 *                   period: "01:00:00"
 *                   node: "gpu02"
 *     responses:
 *       '201':
 *         description: Model created
 *       '400':
 *         description: Invalid payload
 *       '409':
 *         description: Model with id already exists
 */
router.post('/', async (req, res) => {
  try {
    const { id, huggingFaceName, settings = {}, running = null, state = 'Stopped' } = req.body || {};
    // Basic validation
    if (!id || !huggingFaceName) return respond.error(res, 'Missing required fields: id and huggingFaceName', 400);
    // Prevent accidental overwrite: fail if model id already exists
    try {
      const exists = await modelStore.findModel(id);
      if (exists) return respond.error(res, `Model ${id} already exists`, 409);
    } catch (checkErr) {
      return respond.error(res, checkErr.message || 'Failed to check existing models', 500);
    }
    // Construct Model instance to validate
    let modelObj;
    try {
      modelObj = new Model({ id, huggingFaceName, settings, running, state });
    } catch (err) {
      return respond.error(res, err.message || 'Invalid model data', 400);
    }

    try {
      const doc = await modelStore.addModel(id, modelObj.toJSON());
      return respond.created(res, { model: doc });
    } catch (err) {
      return respond.error(res, err.message || 'Failed to persist model', 500);
    }
  } catch (error) {
    return respond.error(res, error.message || 'Failed to create model', 500);
  }
});

/**
 * POST /api/models/:id/run - start a job for the model
 * Body may include: gpuType (a30/a40/a100), port, gpus, cpus, node, period
 *
 * @openapi
 * /api/models/{id}/run:
 *   post:
 *     summary: Start a Slurm job for the specified model
 *     tags:
 *       - Models
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               port:
 *                 type: integer
 *               gpus:
 *                 type: integer
 *               cpus:
 *                 type: integer
 *               node:
 *                 type: string
 *                 description: Node to request (node determines GPU type)
 *               period:
 *                 type: string
 *           examples:
 *             runModelCustomParameters:
 *               summary: Example body to run a model with custom parameters
 *               value:
 *                 port: 9000
 *                 gpus: 4
 *                 cpus: 4
 *                 period: "01:00:00"
 *                 node: "gpu04"
 *     responses:
 *       '200':
 *         description: Job started
 *       '400':
 *         description: Bad request
 *       '409':
 *         description: Model already has a running job
 */
router.post('/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const modelDoc = await modelStore.findModel(id);
    if (!modelDoc) return respond.error(res, `Model ${id} not found`, 404);

    // Prevent starting if a job already exists for this model
    const existingJob = await _findJobForModel(modelDoc.id);
    if (existingJob) return respond.error(res, 'Model already has a running job', 409);

    // Build run options by merging defaults, stored settings, and body overrides
    const baseSettings = Model.defaultSettings();
    const merged = Object.assign({}, baseSettings, modelDoc.settings || {}, body);

    // Determine gpuType from the requested/merged node (defaults to a100)
    const gpuType = _gpuTypeFromNode(merged.node);

    const options = {
      model: modelDoc.huggingFaceName,
      port: Number(merged.port),
      gpus: Number(merged.gpus),
      cpus: Number(merged.cpus),
      node: merged.node,
      period: merged.period
    };

    const result = await slurmService.startJob(gpuType, options);
    if (!result || !result.success) {
      return respond.error(res, result && result.error ? result.error : 'Failed to start job', 500, result || {});
    }

    // If jobId was discovered, persist registration (upsert) so we have mapping
    if (result.jobId) {
      const jobInfo = {
        port: options.port,
        model: modelDoc.id,
        node: result.gpuNode || options.node || '',
        gpuType,
        startTime: new Date().toISOString()
      };
      try {
        await jobStore.addJob(result.jobId, jobInfo);
      } catch (err) {
        // Non-fatal: log and continue
        console.warn('Failed to persist job after start:', err.message || err);
      }

      // Record the job in job history with status 'ongoing'
      try {
        await jobHistoryStore.addJob(result.jobId, {
          modelId: modelDoc.id,
          status: 'ongoing',
          config: {
            port: options.port,
            node: options.node,
            gpus: options.gpus,
            cpus: options.cpus,
            period: options.period
          },
          startTime: jobInfo.startTime
        });
      } catch (err) {
        // Non-fatal: log and continue
        console.warn('Failed to record job in history:', err.message || err);
      }

      // attach startTime to running values we will persist for the model
      // (use jobInfo.startTime whether or not persisting the job succeeded)
      try {
        const runningValues = {
          port: options.port,
          gpus: options.gpus,
          cpus: options.cpus,
          node: options.node,
          period: options.period,
          job_id: result.jobId,
          startTime: jobInfo.startTime,
          time: '00:00:00'
        };
        await modelStore.addModel(id, Object.assign({}, modelDoc, { state: 'Setting up', running: runningValues }));
      } catch (inner) {
        console.warn('Failed to persist model running values after start:', inner.message || inner);
      }
    }

    // If jobId wasn't available we still persist running/startTime with now
    if (!result.jobId) {
      try {
        const nowIso = new Date().toISOString();
        const runningValues = {
          port: options.port,
          gpus: options.gpus,
          cpus: options.cpus,
          node: options.node,
          period: options.period,
          job_id: null,
          startTime: nowIso,
          time: '00:00:00'
        };
        await modelStore.addModel(id, Object.assign({}, modelDoc, { state: 'Setting up', running: runningValues }));
      } catch (err) {
        // Non-fatal
      }
    }

    return respond.success(res, { jobId: result.jobId, gpuNode: result.gpuNode, message: result.message || 'Job started' });
  } catch (error) {
    return respond.error(res, error.message || 'Failed to run model', 500);
  }
});

/**
 * PUT /api/models/:id - update an existing model (partial updates merged)
 *
 * @openapi
 * /api/models/{id}:
 *   put:
 *     summary: Update an existing model (partial update)
 *     tags:
 *       - Models
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               huggingFaceName:
 *                 type: string
 *               settings:
 *                 type: object
 *               running:
 *                 type: object
 *               state:
 *                 type: string
 *           examples:
 *             editedModel:
 *               summary: Example body to edit a model
 *               value:
 *                 id: "deepseek_qwen_7B"
 *                 huggingFaceName: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B"
 *                 settings:
 *                   port: 9000
 *                   gpus: 4
 *                   cpus: 4
 *                   period: "01:00:00"
 *                   node: "gpu02"
 *     responses:
 *       '200':
 *         description: Model updated
 *       '400':
 *         description: Invalid update
 *       '404':
 *         description: Model not found
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    // Find existing
    const existing = await modelStore.findModel(id);
    if (!existing) return respond.error(res, `Model ${id} not found`, 404);

    // Prevent id change
    if (body.id && String(body.id) !== String(id)) {
      return respond.error(res, 'Cannot change model id', 400);
    }

    // Merge fields: allow partial updates for huggingFaceName, settings, running, state
    const newHf = body.huggingFaceName || existing.huggingFaceName;

    // Merge settings deeply (shallow merge of top-level keys)
    const mergedSettings = Object.assign({}, existing.settings || {}, (body.settings || {}));

    // Merge running similarly; if state becomes 'Stopped' ensure running cleared
    let mergedRunning;
    if (body.running === undefined) {
      mergedRunning = Object.assign({}, existing.running || Model.defaultRunning());
    } else if (body.running === null) {
      mergedRunning = Model.defaultRunning();
    } else {
      mergedRunning = Object.assign({}, existing.running || Model.defaultRunning(), body.running);
    }

    const newState = (body.state !== undefined) ? body.state : existing.state;
    if (String(newState).toLowerCase() === 'stopped') {
      mergedRunning = Model.defaultRunning();
    }

    // Validate by constructing a Model instance
    let validated;
    try {
      validated = new Model({ id, huggingFaceName: newHf, settings: mergedSettings, running: mergedRunning, state: newState });
    } catch (err) {
      return respond.error(res, err.message || 'Invalid model update', 400);
    }

    // Persist
    try {
      const doc = await modelStore.addModel(id, validated.toJSON());
      return respond.success(res, { model: doc });
    } catch (err) {
      return respond.error(res, err.message || 'Failed to persist model update', 500);
    }
  } catch (error) {
    return respond.error(res, error.message || 'Failed to update model', 500);
  }
});

/**
 * POST /api/models/:id/stop - stop the job for the specified model
 * 
 *@openapi
 * /api/models/{id}/stop:
 *   post:
 *     summary: Stop the job running the model
 *     tags:
 *       - Models
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Job stopped
 *       '404':
 *         description: Job or model not found
 */
router.post('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    const modelDoc = await modelStore.findModel(id);
    if (!modelDoc) return respond.error(res, `Model ${id} not found`, 404);

    const job = await _findJobForModel(modelDoc.id);
    if (!job) return respond.error(res, 'No running job found for this model', 404);

    const result = await slurmService.cancelJob(job._id);
    if (!result || !result.success) {
      if (result && result.code === 404) return respond.error(res, 'Job not found', 404, result);
      return respond.error(res, result && result.error ? result.error : 'Failed to cancel job', 500, result || {});
    }

    // Update job history status to 'ended'
    try {
      await jobHistoryStore.updateJobStatus(job._id, 'ended');
    } catch (err) {
      // Non-fatal: log and continue
      console.warn('Failed to update job history status:', err.message || err);
    }

    // Update stored model state to Stopped and clear running values
    try {
      await modelStore.addModel(id, Object.assign({}, modelDoc, { state: 'Stopped', running: Model.defaultRunning() }));
    } catch (err) {
      // ignore
    }

    return respond.success(res, { message: 'Model job stopped' });
  } catch (error) {
    return respond.error(res, error.message || 'Failed to stop model', 500);
  }
});

/**
 * DELETE /api/models/:id - remove a model (only allowed if no running job)
 *
 * @openapi
 * /api/models/{id}:
 *   delete:
 *     summary: Remove a stored model
 *     tags:
 *       - Models
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Model removed
 *       '404':
 *         description: Model not found
 *       '409':
 *         description: Model has active job
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const modelDoc = await modelStore.findModel(id);
    if (!modelDoc) return respond.error(res, `Model ${id} not found`, 404);

    const job = await _findJobForModel(modelDoc.id);
    if (job) return respond.error(res, 'Model has an active job; stop it before deleting', 409);

    try {
      await modelStore.removeModel(id);
      return respond.success(res, { message: 'Model removed' });
    } catch (err) {
      return respond.error(res, err.message || 'Failed to remove model', 500);
    }
  } catch (error) {
    return respond.error(res, error.message || 'Failed to delete model', 500);
  }
});

/**
 * GET /api/models/history/all - get all job history entries
 *
 * @openapi
 * /api/models/history/all:
 *   get:
 *     summary: List all job history entries
 *     tags:
 *       - Job History
 *     responses:
 *       '200':
 *         description: List of all job history entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 jobHistory:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       jobId:
 *                         type: string
 *                       modelId:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: ['ongoing', 'ended']
 *                       config:
 *                         type: object
 *                         properties:
 *                           port:
 *                             type: integer
 *                           node:
 *                             type: string
 *                           gpus:
 *                             type: integer
 *                           cpus:
 *                             type: integer
 *                           period:
 *                             type: string
 *                       startTime:
 *                         type: string
 *                       endTime:
 *                         type: string
 */
router.get('/history/all', async (req, res) => {
  try {
    const entries = await jobHistoryStore.getAll();
    return respond.success(res, { count: entries.length, jobHistory: entries });
  } catch (error) {
    return respond.error(res, error.message || 'Failed to retrieve job history', 500);
  }
});

/**
 * GET /api/models/:id/history - get job history for a specific model
 *
 * @openapi
 * /api/models/{id}/history:
 *   get:
 *     summary: Get job history for a specific model
 *     tags:
 *       - Job History
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Job history for the model
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 jobHistory:
 *                   type: array
 *                   items:
 *                     type: object
 *       '404':
 *         description: Model not found
 */
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const modelDoc = await modelStore.findModel(id);
    if (!modelDoc) return respond.error(res, `Model ${id} not found`, 404);

    const entries = await jobHistoryStore.findByModel(modelDoc.id);
    return respond.success(res, { count: entries.length, jobHistory: entries });
  } catch (error) {
    return respond.error(res, error.message || 'Failed to retrieve job history for model', 500);
  }
});

/**
 * DELETE /api/models/history/all - delete all job history entries
 *
 * @openapi
 * /api/models/history/all:
 *   delete:
 *     summary: Delete all job history entries
 *     tags:
 *       - Job History
 *     description: Removes all job history entries from the database
 *     responses:
 *       '200':
 *         description: Job history deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 deletedCount:
 *                   type: integer
 *             examples:
 *               deleted:
 *                 summary: Example response after deletion
 *                 value:
 *                   success: true
 *                   message: "All job history deleted successfully"
 *                   deletedCount: 5
 */
router.delete('/history/all', async (req, res) => {
  try {
    const deletedCount = await jobHistoryStore.removeAll();
    return respond.success(res, { 
      message: 'All job history deleted successfully', 
      deletedCount 
    });
  } catch (error) {
    return respond.error(res, error.message || 'Failed to delete job history', 500);
  }
});

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
router.post('/jobs/register', async (req, res) => {
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
