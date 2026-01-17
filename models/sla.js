/**
 * SLA class representing a Service Level Agreement.
 * This is a stub implementation for now.
 *
 * Properties:
 * - id: string - Unique identifier for the SLA
 * - name: string - SLA name
 */

class SLA {
  /**
   * Create an SLA
   * @param {Object} opts
   * @param {string} opts.id - unique id for the SLA
   * @param {string} opts.name - SLA name
   */
  constructor(opts = {}) {
    if (!opts || typeof opts !== 'object') {
      throw new TypeError('SLA constructor expects an options object');
    }

    const { id, name } = opts;

    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError('SLA.id must be a non-empty string');
    }
    if (typeof name !== 'string' || name.length === 0) {
      throw new TypeError('SLA.name must be a non-empty string');
    }

    this.id = id;
    this.name = name;
  }

  /**
   * Convert to plain object for storage
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name
    };
  }

  /**
   * Create an SLA from a plain object
   */
  static fromJSON(obj) {
    return new SLA({
      id: obj.id,
      name: obj.name
    });
  }
}

module.exports = SLA;
