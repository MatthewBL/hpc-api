/**
 * Model class representing a model configuration and its runtime state.
 *
 * Properties:
 * - id: string
 * - huggingFaceName: string
 * - settings: { port, gpus, cpus, node, period }
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
   * @param {string} [opts.settings.node='gpu08']
   * @param {string} [opts.settings.period='24:00:00']
   * @param {string} [opts.state='stopped']
   */
  constructor(opts = {}) {
    if (!opts || typeof opts !== 'object') {
      throw new TypeError('Model constructor expects an options object');
    }

    const { id, huggingFaceName, settings = {}, state = 'stopped' } = opts;

    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError('Model.id must be a non-empty string');
    }
    if (typeof huggingFaceName !== 'string' || huggingFaceName.length === 0) {
      throw new TypeError('Model.huggingFaceName must be a non-empty string');
    }

    this.id = id;
    this.huggingFaceName = huggingFaceName;
    this.settings = Object.assign({}, Model.defaultSettings(), settings);
    this.state = String(state);

    Model._validateSettings(this.settings);
  }

  static defaultSettings() {
    return {
      port: 9000,
      gpus: 4,
      cpus: 8,
      node: 'gpu08',
      period: '24:00:00',
    };
  }

  static _validateSettings(settings) {
    if (!settings || typeof settings !== 'object') {
      throw new TypeError('settings must be an object');
    }

    const { port, gpus, cpus, node, period } = settings;

    if (!Number.isInteger(port) || port <= 0) {
      throw new TypeError('settings.port must be a positive integer');
    }
    if (!Number.isInteger(gpus) || gpus < 0) {
      throw new TypeError('settings.gpus must be a non-negative integer');
    }
    if (!Number.isInteger(cpus) || cpus < 0) {
      throw new TypeError('settings.cpus must be a non-negative integer');
    }
    if (typeof node !== 'string' || node.length === 0) {
      throw new TypeError('settings.node must be a non-empty string');
    }
    if (typeof period !== 'string' || period.length === 0) {
      throw new TypeError('settings.period must be a non-empty string');
    }
  }

  toJSON() {
    return {
      id: this.id,
      huggingFaceName: this.huggingFaceName,
      settings: Object.assign({}, this.settings),
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
