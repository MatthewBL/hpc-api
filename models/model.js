/**
 * Model class representing a model configuration and its runtime state.
 *
 * Properties:
 * - id: string
 * - huggingFaceName: string
 * - settings: { port, gpus, cpus, node, period, gpuType }
 * - state: string
 */

class Model {
  /**
   * Create a Model
   * @param {Object} opts
   * @param {string} opts.id - unique id for the model
   * @param {string} opts.huggingFaceName - huggingface model name
   * @param {Object} [opts.settings] - running settings
   * @param {number} [opts.settings.port=9000]
   * @param {number} [opts.settings.gpus=4]
   * @param {number} [opts.settings.cpus=8]
  * @param {string} [opts.settings.node='']
   * @param {string} [opts.settings.period='24:00:00']
  * @param {('a30'|'a40'|'a100')} [opts.settings.gpuType='a100']
   * @param {string} [opts.state='stopped']
   */
  constructor(opts = {}) {
    if (!opts || typeof opts !== 'object') {
      throw new TypeError('Model constructor expects an options object');
    }

    const { id, huggingFaceName, settings = {}, running = null, state = 'stopped' } = opts;

    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError('Model.id must be a non-empty string');
    }
    if (typeof huggingFaceName !== 'string' || huggingFaceName.length === 0) {
      throw new TypeError('Model.huggingFaceName must be a non-empty string');
    }

    this.id = id;
    this.huggingFaceName = huggingFaceName;
    this.settings = Object.assign({}, Model.defaultSettings(), settings);
    // running holds actual values used for the active job or nulls while stopped
    if (running == null) {
      this.running = Model.defaultRunning();
    } else {
      this.running = Object.assign({}, Model.defaultRunning(), running);
    }

    this.state = String(state);

    Model._validateSettings(this.settings);
    Model._validateRunning(this.running);
  }

  static defaultSettings() {
    return {
      port: 9000,
      gpus: 4,
      cpus: 8,
      node: '',
      period: '24:00:00',
      gpuType: 'a100'
    };
  }

  static defaultRunning() {
    return {
      port: null,
      gpus: null,
      cpus: null,
      node: null,
      period: null,
      gpuType: null,
      job_id: null,
      startTime: null,
      time: null
    };
  }

  static _validateSettings(settings) {
    if (!settings || typeof settings !== 'object') {
      throw new TypeError('settings must be an object');
    }

    const { port, gpus, cpus, node, period, gpuType } = settings;

    if (!Number.isInteger(port) || port <= 0) {
      throw new TypeError('settings.port must be a positive integer');
    }
    if (!Number.isInteger(gpus) || gpus < 0) {
      throw new TypeError('settings.gpus must be a non-negative integer');
    }
    if (!Number.isInteger(cpus) || cpus < 0) {
      throw new TypeError('settings.cpus must be a non-negative integer');
    }
    // Node is optional; allow empty string to let scheduler pick
    if (typeof node !== 'string') {
      throw new TypeError('settings.node must be a string');
    }
    if (typeof period !== 'string' || period.length === 0) {
      throw new TypeError('settings.period must be a non-empty string');
    }
    if (gpuType !== undefined && gpuType !== null) {
      if (typeof gpuType !== 'string' || !['a30','a40','a100'].includes(gpuType)) {
        throw new TypeError("settings.gpuType must be one of 'a30', 'a40', 'a100'");
      }
    }
  }

  static _validateRunning(running) {
    if (!running || typeof running !== 'object') {
      throw new TypeError('running must be an object');
    }

    const { port, gpus, cpus, node, period, job_id, gpuType } = running;

    if (port !== null && (!Number.isInteger(port) || port <= 0)) {
      throw new TypeError('running.port must be null or a positive integer');
    }
    if (gpus !== null && (!Number.isInteger(gpus) || gpus < 0)) {
      throw new TypeError('running.gpus must be null or a non-negative integer');
    }
    if (cpus !== null && (!Number.isInteger(cpus) || cpus < 0)) {
      throw new TypeError('running.cpus must be null or a non-negative integer');
    }
    // Node optional during runtime as well
    if (node !== null && (typeof node !== 'string')) {
      throw new TypeError('running.node must be null or a string');
    }
    if (period !== null && (typeof period !== 'string' || period.length === 0)) {
      throw new TypeError('running.period must be null or a non-empty string');
    }
    if (job_id !== null && (typeof job_id !== 'string' || job_id.length === 0)) {
      throw new TypeError('running.job_id must be null or a non-empty string');
    }
    if (gpuType !== null && (typeof gpuType !== 'string' || !['a30','a40','a100'].includes(gpuType))) {
      throw new TypeError("running.gpuType must be null or one of 'a30', 'a40', 'a100'");
    }
    // Optional time fields
    const { startTime, time } = running;
    if (startTime !== null && (typeof startTime !== 'string' || startTime.length === 0)) {
      throw new TypeError('running.startTime must be null or a non-empty ISO string');
    }
    if (time !== null && (typeof time !== 'string' || time.length === 0)) {
      throw new TypeError('running.time must be null or a non-empty string');
    }
  }

  toJSON() {
    return {
      id: this.id,
      huggingFaceName: this.huggingFaceName,
      settings: Object.assign({}, this.settings),
      running: Object.assign({}, this.running),
      state: this.state,
    };
  }

  /**
   * Create a Model from a plain object (e.g., parsed JSON)
   * @param {Object} obj
   * @returns {Model}
   */
  static fromObject(obj) {
    return new Model(obj);
  }
}

module.exports = Model;
