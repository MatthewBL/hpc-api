const express = require('express');
const path = require('path');
const fs = require('fs');
const respond = require('../utils/response');
const Model = require('../models/model');
const modelStore = require('../services/modelStore');
const jobStore = require('../services/jobStore');
const jobHistoryStore = require('../services/jobHistoryStore');
const slurmService = require('../services/slurmService');
const { getGpuUsage } = require('../services/gpuAvailabilityService');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const axios = require('axios');
const { spawn } = require('child_process');

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

/**
 * Derive model state dynamically using squeue and logs.
 * - No job mapped → Stopped
 * - Job missing from squeue → Stopped and detach jobId/history
 * - Job in squeue PENDING → Setting up
 * - Job in squeue RUNNING but log missing startup marker → Setting up
 * - Job in squeue RUNNING and startup marker present → Running
 */
async function _deriveStateForModel(modelDoc) {
  const job = await _findJobForModel(modelDoc.id);
  if (!job) return { state: 'Stopped', job: null };

  // Query current jobs and check presence/state
  const statusResp = await slurmService.getJobStatus();
  if (!statusResp.success) {
    // Fallback: directly query squeue for this jobId; if missing, detach and mark Stopped
    try {
      const { stdout } = await execAsync(`squeue -j ${job._id} --noheader -o "%i"`);
      const present = String(stdout || '').trim();
      if (!present) {
        try { await jobStore.removeJob(job._id); } catch {}
        try { await jobHistoryStore.updateJobStatus(job._id, 'ended'); } catch {}
        try {
          await modelStore.addModel(modelDoc.id, Object.assign({}, modelDoc, { running: Model.defaultRunning() }));
        } catch {}
        return { state: 'Stopped', job: null };
      }
    } catch (e) {
      // If fallback also fails, conservatively report Setting up
      return { state: 'Setting up', job };
    }
    // If fallback indicates job is present, keep deriving as Setting up for now
    return { state: 'Setting up', job };
  }

  const found = (statusResp.jobs || []).find(j => String(j.id) === String(job._id));
  if (!found) {
    // Detach job since it's no longer in squeue
    try { await jobStore.removeJob(job._id); } catch {}
    try { await jobHistoryStore.updateJobStatus(job._id, 'ended'); } catch {}
    try {
      await modelStore.addModel(modelDoc.id, Object.assign({}, modelDoc, { running: Model.defaultRunning() }));
    } catch {}
    return { state: 'Stopped', job: null };
  }

  const st = String(found.status).toUpperCase();
  if (st.includes('PEND')) {
    return { state: 'Setting up', job };
  }

  if (st.includes('RUN')) {
    // Check logs for startup completion marker
    const jobLog = path.join(__dirname, '..', 'logs', `slurm-${job._id}.out`);
    try {
      const content = fs.readFileSync(jobLog, 'utf8');
      const started = content.includes('INFO:     Application startup complete.') || content.includes('Available routes are:');
      return { state: started ? 'Running' : 'Setting up', job };
    } catch (err) {
      // If log missing treat as setting up
      return { state: 'Setting up', job };
    }
  }

  // Other states (e.g., COMPLETING) → treat as setting up
  return { state: 'Setting up', job };
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

function _normalizeGpuType(val, fallback = 'a100') {
  if (!val) return fallback;
  const v = String(val).toLowerCase();
  return ['a30','a40','a100'].includes(v) ? v : fallback;
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
        const { state, job } = await _deriveStateForModel(doc);
        // Ensure running field exists on older documents
        const baseRunning = (doc.running && typeof doc.running === 'object')
          ? Object.assign({}, Model.defaultRunning(), doc.running)
          : Model.defaultRunning();

        // Preserve stored running info even when no job mapping exists
        let runningNormalized = Object.assign({}, baseRunning);

        // Compute elapsed time if we have a startTime
        if (runningNormalized.startTime) {
          runningNormalized.time = _formatElapsed(runningNormalized.startTime);
        }

        // If a job exists, enrich running fields from the job mapping
        if (job) {
          if (!runningNormalized.startTime && job.startTime) runningNormalized.startTime = job.startTime;
          if (!runningNormalized.job_id) runningNormalized.job_id = String(job._id);
          // If startTime still missing, derive from squeue submit time (%V) and persist to jobStore
          if (!runningNormalized.startTime) {
            try {
              const { stdout: submitOut = '' } = await execAsync(`squeue -j ${job._id} --noheader -o "%V"`);
              const submitStr = String(submitOut || '').trim();
              if (submitStr && submitStr.toLowerCase() !== 'n/a') {
                const submitDate = new Date(submitStr);
                if (!Number.isNaN(submitDate.getTime())) {
                  runningNormalized.startTime = submitDate.toISOString();
                  try {
                    await jobStore.addJob(job._id, Object.assign({}, job, { startTime: runningNormalized.startTime }));
                  } catch {}
                }
              }
            } catch {}
          }
          runningNormalized.time = runningNormalized.startTime ? _formatElapsed(runningNormalized.startTime) : null;
        }

        // With time computed, check for auto-cancel if pending > TIMEOUT_INSUFFICIENT_RESOURCES
        try {
          const modelInst = Model.fromObject(Object.assign({}, doc, { running: runningNormalized }));
          const cancelRes = await modelInst.maybeAutoCancelPending(30);
          if (cancelRes && cancelRes.canceled) {
            // Re-derive state after cancel
            const re = await _deriveStateForModel(doc);
            const runningAfter = Model.defaultRunning();
            return Object.assign({}, doc, { state: re.state, running: runningAfter });
          }
        } catch {}

        // If still "Setting up", enforce TIMEOUT_SETTING_UP to auto-cancel
        try {
          if (state === 'Setting up') {
            const modelInst = Model.fromObject(Object.assign({}, doc, { running: runningNormalized }));
            const cancelResSetup = await modelInst.maybeAutoCancelSettingUp();
            if (cancelResSetup && cancelResSetup.canceled) {
              const re = await _deriveStateForModel(doc);
              const runningAfter = Model.defaultRunning();
              return Object.assign({}, doc, { state: re.state, running: runningAfter });
            }
          }
        } catch {}

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
 * GET /api/models/test-prompt
 *
 * Tests a prompt against the LLM running on a GPU node (vLLM server)
 * and returns the model's answer. If the request fails, returns error details
 * to diagnose whether the LLM endpoint is alive.
 *
 * Query params:
 * - node: gpu01..gpu08 (optional; if missing, tries first running job)
 * - port: service port (optional; if missing, tries to infer from jobStore or defaults to 9000)
 * - model: served model name for OpenAI-compatible endpoint (optional; inferred when possible)
 * - prompt: text to send (optional; default: "Hello world")
 * - timeoutMs: request timeout in ms (optional; default: 5000)
 * - temperature, max_tokens: generation controls (optional)
 */
router.get('/test-prompt', async (req, res) => {
  try {
    const prompt = String(req.query.prompt || 'Hello world');
    const temperature = req.query.temperature !== undefined ? Number(req.query.temperature) : 0;
    const maxTokens = req.query.max_tokens !== undefined ? Number(req.query.max_tokens) : 64;
    const timeoutMs = req.query.timeoutMs !== undefined ? Number(req.query.timeoutMs) : 5000;

    let node = req.query.node ? String(req.query.node) : '';
    let port = req.query.port !== undefined ? Number(req.query.port) : NaN;
    let modelName = req.query.model ? String(req.query.model) : '';

    if (node) {
      if (!/^gpu0[1-8]$/.test(node)) {
        return respond.error(res, 'Invalid node. Must be one of gpu01-08.', 400);
      }
    }

    // Try to infer node/port/model from current jobs if not fully provided
    try {
      if (!node || !Number.isFinite(port) || !modelName) {
        const jobs = await jobStore.getAll();
        let match = null;
        if (node) {
          match = jobs.find(j => String(j.node).toLowerCase() === node.toLowerCase()) || null;
        } else {
          match = jobs[0] || null;
        }
        if (match) {
          if (!node) node = String(match.node || '');
          if (!Number.isFinite(port)) port = Number(match.port);
          if (!modelName) modelName = String(match.model || '');
        }
      }
    } catch (_) {
      // ignore inference errors; we'll validate below
    }

    // Apply sensible defaults if still missing
    if (!node) node = 'gpu01';
    if (!/^gpu0[1-8]$/.test(node)) {
      return respond.error(res, 'Invalid node. Must be one of gpu01-08.', 400);
    }
    if (!Number.isFinite(port)) port = 9000;

    const baseUrl = `http://${node}:${port}`;

    // If model name still unknown, attempt to fetch served models (OpenAI-compatible list)
    if (!modelName) {
      try {
        const m = await axios.get(`${baseUrl}/v1/models`, { timeout: Math.max(2000, Math.floor(timeoutMs / 2)) });
        if (m.data && Array.isArray(m.data.data) && m.data.data.length > 0) {
          modelName = String(m.data.data[0].id || '');
        }
      } catch (_) {
        // Fallback to placeholder; many vLLM builds ignore the model field
        modelName = 'default';
      }
      if (!modelName) modelName = 'default';
    }

    // Call OpenAI-compatible chat completions endpoint on vLLM
    const payload = {
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature
    };

    try {
      const resp = await axios.post(`${baseUrl}/v1/chat/completions`, payload, { timeout: timeoutMs });

      let answer = null;
      if (resp.data && Array.isArray(resp.data.choices) && resp.data.choices.length > 0) {
        const choice = resp.data.choices[0];
        if (choice && choice.message && typeof choice.message.content === 'string') {
          answer = choice.message.content;
        } else if (typeof choice.text === 'string') {
          // Some servers use `text` instead of `message.content`
          answer = choice.text;
        }
      }

      return respond.success(res, {
        alive: true,
        node,
        port,
        model: modelName,
        prompt,
        answer,
        raw: resp.data
      });
    } catch (err) {
      let errorMessage = err && err.message ? err.message : 'Unknown error';
      let details = undefined;
      if (err && err.response) {
        details = err.response.data;
        if (details && details.error) {
          if (typeof details.error === 'string') errorMessage = details.error;
          else if (details.error.message) errorMessage = details.error.message;
        } else if (typeof details === 'string') {
          errorMessage = details;
        }
      }

      // Return a 200 with alive=false and captured error details to aid diagnosis
      return respond.success(res, {
        alive: false,
        node,
        port,
        model: modelName,
        prompt,
        error: errorMessage,
        details
      });
    }
  } catch (error) {
    return respond.error(res, error.message || 'Failed to test prompt', 500);
  }
});

/**
 * Endpoint to get GPU availability.
 */
router.get('/gpu-availability', (req, res) => {
    try {
        const gpuUsage = getGpuUsage();
        res.status(200).json({
            success: true,
            data: gpuUsage
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/models/status - generate and return cluster usage JSON
 *
 * Runs the Python script scripts/uso_cluster_to_json.py to convert
 * uso_cluster.txt into uso_cluster.json, then returns the JSON content.
 */
router.get('/status', async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'uso_cluster_to_json.py');
    const inputPath = path.join(__dirname, '../../../../../', 'uso_cluster.txt');
    const outputPath = path.join(__dirname, '..', 'uso_cluster.json');

    // Determine python executable cross-platform
    const py = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

    // Spawn the Python process
    const args = [scriptPath, '--input', inputPath, '--output', outputPath];

    const runScript = () => new Promise((resolve, reject) => {
      const p = spawn(py, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      p.stderr.on('data', (d) => { stderr += d.toString(); });
      p.on('error', (err) => reject(err));
      p.on('close', (code) => {
        if (code !== 0) return reject(new Error(stderr || `Python exited with code ${code}`));
        return resolve(true);
      });
    });

    await runScript();

    // Read the generated JSON file
    let content = {};
    try {
      const raw = fs.readFileSync(outputPath, 'utf8');
      content = JSON.parse(raw);
    } catch (readErr) {
      return respond.error(res, readErr.message || 'Failed to read generated JSON', 500);
    }

    return respond.success(res, { content });
  } catch (error) {
    return respond.error(res, error.message || 'Failed to generate status JSON', 500);
  }
});

/**
 * GET /api/models/status/last - generate and return latest cluster usage JSON
 *
 * Runs the Python script scripts/uso_cluster_to_json.py with the `--last` flag
 * to convert only the latest timestamp block from uso_cluster.txt into
 * uso_cluster_last.json, then returns the JSON content.
 */
router.get('/status/last', async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'uso_cluster_to_json.py');
    const inputPath = path.join(__dirname, '../../../../../', 'uso_cluster.txt');
    const outputPath = path.join(__dirname, '..', 'uso_cluster_last.json');

    // Determine python executable cross-platform
    const py = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

    // Spawn the Python process with --last
    const args = [scriptPath, '--input', inputPath, '--output', outputPath, '--last'];

    const runScript = () => new Promise((resolve, reject) => {
      const p = spawn(py, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      p.stderr.on('data', (d) => { stderr += d.toString(); });
      p.on('error', (err) => reject(err));
      p.on('close', (code) => {
        if (code !== 0) return reject(new Error(stderr || `Python exited with code ${code}`));
        return resolve(true);
      });
    });

    await runScript();

    // Read the generated JSON file
    let content = {};
    try {
      const raw = fs.readFileSync(outputPath, 'utf8');
      content = JSON.parse(raw);
    } catch (readErr) {
      return respond.error(res, readErr.message || 'Failed to read generated JSON', 500);
    }

    return respond.success(res, { content });
  } catch (error) {
    return respond.error(res, error.message || 'Failed to generate latest status JSON', 500);
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

    const { state, job } = await _deriveStateForModel(doc);
    const baseRunning = (doc.running && typeof doc.running === 'object')
      ? Object.assign({}, Model.defaultRunning(), doc.running)
      : Model.defaultRunning();

    let runningNormalized = Object.assign({}, baseRunning);
    if (runningNormalized.startTime) {
      runningNormalized.time = _formatElapsed(runningNormalized.startTime);
    }
    if (job) {
      if (!runningNormalized.startTime && job.startTime) runningNormalized.startTime = job.startTime;
      if (!runningNormalized.job_id) runningNormalized.job_id = String(job._id);
      // If startTime still missing, derive from squeue submit time and persist
      if (!runningNormalized.startTime) {
        try {
          const { stdout: submitOut = '' } = await execAsync(`squeue -j ${job._id} --noheader -o "%V"`);
          const submitStr = String(submitOut || '').trim();
          if (submitStr && submitStr.toLowerCase() !== 'n/a') {
            const submitDate = new Date(submitStr);
            if (!Number.isNaN(submitDate.getTime())) {
              runningNormalized.startTime = submitDate.toISOString();
              try {
                await jobStore.addJob(job._id, Object.assign({}, job, { startTime: runningNormalized.startTime }));
              } catch {}
            }
          }
        } catch {}
      }
      runningNormalized.time = runningNormalized.startTime ? _formatElapsed(runningNormalized.startTime) : null;
    }
    // Auto-cancel now that time is available
    try {
      const modelInst = Model.fromObject(Object.assign({}, doc, { running: runningNormalized }));
      const cancelRes = await modelInst.maybeAutoCancelPending(30);
      if (cancelRes && cancelRes.canceled) {
        const re = await _deriveStateForModel(doc);
        return respond.success(res, { model: Object.assign({}, doc, { state: re.state, running: Model.defaultRunning() }) });
      }
    } catch {}

    // If still "Setting up", enforce TIMEOUT_SETTING_UP to auto-cancel
    try {
      if (state === 'Setting up') {
        const modelInst = Model.fromObject(Object.assign({}, doc, { running: runningNormalized }));
        const cancelResSetup = await modelInst.maybeAutoCancelSettingUp();
        if (cancelResSetup && cancelResSetup.canceled) {
          const re = await _deriveStateForModel(doc);
          return respond.success(res, { model: Object.assign({}, doc, { state: re.state, running: Model.defaultRunning() }) });
        }
      }
    } catch {}

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

    const { state, job } = await _deriveStateForModel(doc);
    const baseRunning = (doc.running && typeof doc.running === 'object')
      ? Object.assign({}, Model.defaultRunning(), doc.running)
      : Model.defaultRunning();

    let runningNormalized = Object.assign({}, baseRunning);
    if (runningNormalized.startTime) {
      runningNormalized.time = _formatElapsed(runningNormalized.startTime);
    }
    if (job) {
      if (!runningNormalized.startTime && job.startTime) runningNormalized.startTime = job.startTime;
      if (!runningNormalized.job_id) runningNormalized.job_id = String(job._id);
      // If startTime still missing, derive from squeue submit time and persist
      if (!runningNormalized.startTime) {
        try {
          const { stdout: submitOut = '' } = await execAsync(`squeue -j ${job._id} --noheader -o "%V"`);
          const submitStr = String(submitOut || '').trim();
          if (submitStr && submitStr.toLowerCase() !== 'n/a') {
            const submitDate = new Date(submitStr);
            if (!Number.isNaN(submitDate.getTime())) {
              runningNormalized.startTime = submitDate.toISOString();
              try {
                await jobStore.addJob(job._id, Object.assign({}, job, { startTime: runningNormalized.startTime }));
              } catch {}
            }
          }
        } catch {}
      }
      runningNormalized.time = runningNormalized.startTime ? _formatElapsed(runningNormalized.startTime) : null;
    }
    // Auto-cancel now that time is available
    try {
      const modelInst = Model.fromObject(Object.assign({}, doc, { running: runningNormalized }));
      const cancelRes = await modelInst.maybeAutoCancelPending(30);
      if (cancelRes && cancelRes.canceled) {
        const re = await _deriveStateForModel(doc);
        return respond.success(res, { state: re.state, running: Model.defaultRunning() });
      }
    } catch {}

    // If still "Setting up", enforce TIMEOUT_SETTING_UP to auto-cancel
    try {
      if (state === 'Setting up') {
        const modelInst = Model.fromObject(Object.assign({}, doc, { running: runningNormalized }));
        const cancelResSetup = await modelInst.maybeAutoCancelSettingUp();
        if (cancelResSetup && cancelResSetup.canceled) {
          const re = await _deriveStateForModel(doc);
          return respond.success(res, { state: re.state, running: Model.defaultRunning() });
        }
      }
    } catch {}

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

    // Determine gpuType preference: explicit body.gpuType > model.settings.gpuType > derived from node > 'a100'
    const gpuType = _normalizeGpuType(body.gpuType, _normalizeGpuType(modelDoc.settings?.gpuType, _gpuTypeFromNode(merged.node)));

    const options = {
      model: modelDoc.huggingFaceName,
      port: Number(merged.port),
      gpus: Number(merged.gpus),
      cpus: Number(merged.cpus),
      node: merged.node || '',
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
            period: options.period,
            gpuType
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
          gpuType,
          job_id: result.jobId,
          startTime: jobInfo.startTime,
          time: '00:00:00'
        };
        // Do not persist state; runtime state is derived on read
        await modelStore.addModel(id, Object.assign({}, modelDoc, { running: runningValues }));
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
          gpuType,
          job_id: null,
          startTime: nowIso,
          time: '00:00:00'
        };
        // Do not persist state; runtime state is derived on read
        await modelStore.addModel(id, Object.assign({}, modelDoc, { running: runningValues }));
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

    // Clear running values (do not persist state; derive on read)
    try {
      await modelStore.addModel(id, Object.assign({}, modelDoc, { running: Model.defaultRunning() }));
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
module.exports = router;
