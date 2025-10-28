const axios = require('axios');

class LLMQueryService {
  constructor() {
    this.activeJobs = new Map(); // jobId -> { port, model, node }
  }

  // Register a running job so we know where to send queries
  registerJob(jobId, jobInfo) {
    this.activeJobs.set(jobId, jobInfo);
  }

  // Unregister a completed/cancelled job
  unregisterJob(jobId) {
    this.activeJobs.delete(jobId);
  }

  // Get all active jobs with their details
  getActiveJobs() {
    return Array.from(this.activeJobs.entries()).map(([jobId, info]) => ({
      jobId,
      ...info
    }));
  }

  // Find job by ID or get first available
  findJob(jobId = null) {
    if (jobId) {
      return this.activeJobs.get(jobId);
    }
    // Return first available job if no specific jobId provided
    const firstEntry = this.activeJobs.entries().next();
    return firstEntry.value ? firstEntry.value[1] : null;
  }

  // Send query to LLM
  async sendQuery(jobId, messages, options = {}) {
    const job = this.findJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found or not active`);
    }

    const {
      model = job.model,
      temperature = 0,
      seed = 41008,
      logprobs = true,
      max_tokens = null,
      timeout = 30000 // 30 seconds default timeout
    } = options;

    const requestData = {
      model,
      messages,
      temperature,
      seed,
      logprobs
    };

    // Add optional max_tokens if provided
    if (max_tokens !== null) {
      requestData.max_tokens = max_tokens;
    }

    try {
      const startTime = Date.now();
      const response = await axios.post(
        `http://${job.node}:${job.port}/v1/chat/completions`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout
        }
      );

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      return {
        success: true,
        data: response.data,
        responseTime: `${responseTime}ms`,
        jobInfo: {
          jobId,
          port: job.port,
          model: job.model,
          node: job.node
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        jobInfo: {
          jobId,
          port: job.port,
          model: job.model,
          node: job.node
        }
      };
    }
  }
}

module.exports = new LLMQueryService();