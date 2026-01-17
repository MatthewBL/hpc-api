/**
 * APIKey class representing an API Key and its associated SLAs.
 *
 * Properties:
 * - id: string - The API Key itself
 * - slas: array - List of SLA identifiers assigned to this API Key
 */

class APIKey {
  /**
   * Create an APIKey
   * @param {Object} opts
   * @param {string} opts.id - the API Key value
   * @param {Array<string>} [opts.slas=[]] - list of SLA identifiers
   */
  constructor(opts = {}) {
    if (!opts || typeof opts !== 'object') {
      throw new TypeError('APIKey constructor expects an options object');
    }

    const { id, slas = [] } = opts;

    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError('APIKey.id must be a non-empty string');
    }
    if (!Array.isArray(slas)) {
      throw new TypeError('APIKey.slas must be an array');
    }

    this.id = id;
    this.slas = slas;
  }

  /**
   * Add an SLA to the API Key
   * @param {string} slaId - SLA identifier to add
   */
  addSLA(slaId) {
    if (!this.slas.includes(slaId)) {
      this.slas.push(slaId);
    }
  }

  /**
   * Remove an SLA from the API Key
   * @param {string} slaId - SLA identifier to remove
   */
  removeSLA(slaId) {
    const index = this.slas.indexOf(slaId);
    if (index > -1) {
      this.slas.splice(index, 1);
    }
  }

  /**
   * Convert to plain object for storage
   */
  toJSON() {
    return {
      id: this.id,
      slas: this.slas
    };
  }

  /**
   * Create an APIKey from a plain object
   */
  static fromJSON(obj) {
    return new APIKey({
      id: obj.id,
      slas: obj.slas || []
    });
  }
}

module.exports = APIKey;
