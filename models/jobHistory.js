/**
 * JobHistory class representing a recorded job execution history entry.
 *
 * Properties:
 * - jobId: string - the SLURM job ID
 * - modelId: string - the model that was running
 * - status: string - 'ongoing' or 'ended'
 * - config: Object - { port, node, gpus, cpus, period }
 * - startTime: string - ISO timestamp when job started
 * - endTime: string - ISO timestamp when job ended (null if ongoing)
 */

class JobHistory {
  /**
   * Create a JobHistory entry
   * @param {Object} opts
   * @param {string} opts.jobId - SLURM job ID
   * @param {string} opts.modelId - model identifier
   * @param {string} [opts.status='ongoing'] - 'ongoing' or 'ended'
   * @param {Object} [opts.config] - { port, node, gpus, cpus, period }
   * @param {string} [opts.startTime] - ISO timestamp
   * @param {string} [opts.endTime] - ISO timestamp
   */
  constructor(opts = {}) {
    if (!opts || typeof opts !== 'object') {
      throw new TypeError('JobHistory constructor expects an options object');
    }

    const { jobId, modelId, status = 'ongoing', config = {}, startTime, endTime } = opts;

    if (typeof jobId !== 'string' || jobId.length === 0) {
      throw new TypeError('JobHistory.jobId must be a non-empty string');
    }
    if (typeof modelId !== 'string' || modelId.length === 0) {
      throw new TypeError('JobHistory.modelId must be a non-empty string');
    }

    this.jobId = jobId;
    this.modelId = modelId;
    this.status = String(status);
    this.config = Object.assign({}, JobHistory.defaultConfig(), config);
    this.startTime = startTime || new Date().toISOString();
    this.endTime = endTime || null;

    JobHistory._validateStatus(this.status);
    JobHistory._validateConfig(this.config);
  }

  static defaultConfig() {
    return {
      port: null,
      node: null,
      gpus: null,
      cpus: null,
      period: null
    };
  }

  static _validateStatus(status) {
    const validStatuses = ['ongoing', 'ended'];
    if (!validStatuses.includes(status)) {
      throw new TypeError(`status must be one of: ${validStatuses.join(', ')}`);
    }
  }

  static _validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new TypeError('config must be an object');
    }

    const { port, gpus, cpus, node, period } = config;

    if (port !== null && (!Number.isInteger(port) || port <= 0)) {
      throw new TypeError('config.port must be null or a positive integer');
    }
    if (gpus !== null && (!Number.isInteger(gpus) || gpus < 0)) {
      throw new TypeError('config.gpus must be null or a non-negative integer');
    }
    if (cpus !== null && (!Number.isInteger(cpus) || cpus < 0)) {
      throw new TypeError('config.cpus must be null or a non-negative integer');
    }
    if (node !== null && (typeof node !== 'string' || node.length === 0)) {
      throw new TypeError('config.node must be null or a non-empty string');
    }
    if (period !== null && (typeof period !== 'string' || period.length === 0)) {
      throw new TypeError('config.period must be null or a non-empty string');
    }
  }

  toJSON() {
    return {
      jobId: this.jobId,
      modelId: this.modelId,
      status: this.status,
      config: Object.assign({}, this.config),
      startTime: this.startTime,
      endTime: this.endTime
    };
  }

  /**
   * Create a JobHistory from a plain object
   * @param {Object} obj
   * @returns {JobHistory}
   */
  static fromObject(obj) {
    return new JobHistory(obj);
  }
}

module.exports = JobHistory;
