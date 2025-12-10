const express = require('express');
const path = require('path');
const fs = require('fs');
const respond = require('../utils/response');
const Model = require('../models/model');
const modelStore = require('../services/modelStore');
const jobStore = require('../services/jobStore');
const slurmService = require('../services/slurmService');

const router = express.Router();

// Helpers
async function _findJobForModel(huggingFaceName) {
  const jobs = await jobStore.getAll();
  return jobs.find(j => String(j.model) === String(huggingFaceName)) || null;
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
 */
router.get('/', async (req, res) => {
  try {
    const docs = await modelStore.getAll();

    const modelsWithState = await Promise.all(docs.map(async (doc) => {
      try {
        const job = await _findJobForModel(doc.huggingFaceName);
        const state = _stateFromJob(job);
        // Ensure running field exists on older documents
        const running = (doc.running && typeof doc.running === 'object') ? doc.running : Model.defaultRunning();
        // If no job, running must be nulls
        const runningNormalized = job ? running : Model.defaultRunning();
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
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await modelStore.findModel(id);
    if (!doc) return respond.error(res, `Model ${id} not found`, 404);

    const job = await _findJobForModel(doc.huggingFaceName);
    const state = _stateFromJob(job);
    const running = (doc.running && typeof doc.running === 'object') ? doc.running : Model.defaultRunning();
    const runningNormalized = job ? running : Model.defaultRunning();

    return respond.success(res, { model: Object.assign({}, doc, { state, running: runningNormalized }) });
  } catch (error) {
    return respond.error(res, error.message || 'Failed to get model', 500);
  }
});

/**
 * GET /api/models/:id/state - get only the state (Stopped/Setting up/Running)
 */
router.get('/:id/state', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await modelStore.findModel(id);
    if (!doc) return respond.error(res, `Model ${id} not found`, 404);

    const job = await _findJobForModel(doc.huggingFaceName);
    const state = _stateFromJob(job);
    const running = (doc.running && typeof doc.running === 'object') ? doc.running : Model.defaultRunning();
    const runningNormalized = job ? running : Model.defaultRunning();
    return respond.success(res, { state, running: runningNormalized });
  } catch (error) {
    return respond.error(res, error.message || 'Failed to get model state', 500);
  }
});

/**
 * POST /api/models - create a new model
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
 */
router.post('/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const modelDoc = await modelStore.findModel(id);
    if (!modelDoc) return respond.error(res, `Model ${id} not found`, 404);

    // Prevent starting if a job already exists for this model
    const existingJob = await _findJobForModel(modelDoc.huggingFaceName);
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
    try {
      if (result.jobId) {
        const jobInfo = {
          port: options.port,
          model: modelDoc.huggingFaceName,
          node: result.gpuNode || options.node || '',
          gpuType,
          startTime: new Date().toISOString()
        };
        await jobStore.addJob(result.jobId, jobInfo);
      }
    } catch (err) {
      // Non-fatal: log and continue
      console.warn('Failed to persist job after start:', err.message || err);
    }

    // Update stored model state to Setting up and set running values
    try {
      const runningValues = {
        port: options.port,
        gpus: options.gpus,
        cpus: options.cpus,
        node: options.node,
        period: options.period
      };
      await modelStore.addModel(id, Object.assign({}, modelDoc, { state: 'Setting up', running: runningValues }));
    } catch (err) {
      // Non-fatal
    }

    return respond.success(res, { jobId: result.jobId, gpuNode: result.gpuNode, message: result.message || 'Job started' });
  } catch (error) {
    return respond.error(res, error.message || 'Failed to run model', 500);
  }
});

/**
 * PUT /api/models/:id - update an existing model (partial updates merged)
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
 */
router.post('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    const modelDoc = await modelStore.findModel(id);
    if (!modelDoc) return respond.error(res, `Model ${id} not found`, 404);

    const job = await _findJobForModel(modelDoc.huggingFaceName);
    if (!job) return respond.error(res, 'No running job found for this model', 404);

    const result = await slurmService.cancelJob(job._id);
    if (!result || !result.success) {
      if (result && result.code === 404) return respond.error(res, 'Job not found', 404, result);
      return respond.error(res, result && result.error ? result.error : 'Failed to cancel job', 500, result || {});
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
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const modelDoc = await modelStore.findModel(id);
    if (!modelDoc) return respond.error(res, `Model ${id} not found`, 404);

    const job = await _findJobForModel(modelDoc.huggingFaceName);
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

module.exports = router;
