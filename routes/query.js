// routes/query.js
const express = require('express');
const llmQueryService = require('../services/llmQueryService');
const router = express.Router();

/**
 * @openapi
 * /api/query:
 *   post:
 *     summary: Run a query against the LLM service (auto-selects an active job)
 *     tags:
 *       - Query
 *     description: |
 *       Sends the provided conversation messages to the first available active job. 
 *       The request body MUST include `messages`. Do NOT provide `jobId` or `model` in the
 *       request body — `jobId` is only accepted via the URL variant and `model` is always
 *       taken from the chosen job's configuration.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *             properties:
 *               messages:
 *                 type: array
 *                 description: Array of message objects for the conversation
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant, system]
 *                     content:
 *                       type: string
 *                   example: { role: "user", content: "Hello" }
 *               # jobId and model are intentionally NOT accepted here. Use POST /api/query/{jobId}
 *               temperature:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 2
 *                 default: 0
 *               seed:
 *                 type: integer
 *                 default: 41008
 *               logprobs:
 *                 type: boolean
 *                 default: true
 *               max_tokens:
 *                 type: integer
 *                 description: Maximum number of tokens to generate
 *               timeout:
 *                 type: integer
 *                 description: Timeout in milliseconds
 *                 default: 30000
 *     responses:
 *       200:
 *         description: Query processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: The upstream LLM response payload
 *                 responseTime:
 *                   type: string
 *                 jobInfo:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                     port:
 *                       type: integer
 *                     model:
 *                       type: string
 *                     node:
 *                       type: string
 *       400:
 *         description: Bad request (e.g. missing messages, jobId/model provided in body)
 *       404:
 *         description: No active jobs available
 *       500:
 *         description: Internal server error
 */
// Send query to a specific job or first available
router.post('/', async (req, res) => {
  try {
    const { 
      messages, 
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

/**
 * @openapi
 * /api/query/{jobId}:
 *   post:
 *     summary: Run a query on a specific job by ID
 *     tags:
 *       - Query
 *     description: |
 *       Sends the provided conversation messages to the specified active job.
 *       The `jobId` is required in the path. The request body MUST include `messages`.
 *       The `model` field is NOT accepted in the request body; the job's configured model will be used.
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *             properties:
 *               messages:
 *                 type: array
 *                 description: Conversation messages to send to the job
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant, system]
 *                     content:
 *                       type: string
 *               temperature:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 2
 *                 default: 0
 *               seed:
 *                 type: integer
 *                 default: 41008
 *               logprobs:
 *                 type: boolean
 *                 default: true
 *               max_tokens:
 *                 type: integer
 *               timeout:
 *                 type: integer
 *                 default: 30000
 *     responses:
 *       200:
 *         description: Query processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 responseTime:
 *                   type: string
 *                 jobInfo:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                     port:
 *                       type: integer
 *                     model:
 *                       type: string
 *                     node:
 *                       type: string
 *       400:
 *         description: Bad request (e.g. missing messages, model provided in body)
 *       404:
 *         description: Job not found or not active
 *       500:
 *         description: Internal server error
 */
// Send query to a specific job by ID
router.post('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { 
      messages, 
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