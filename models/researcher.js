/**
 * Researcher class representing a researcher entity.
 *
 * Properties:
 * - id: string - Unique identifier automatically assigned upon creation. Cannot be modified
 * - name: string - Researcher name
 * - email: string - Researcher email
 * - apiKey: string - API Key (has no value until an SLA is assigned)
 */

class Researcher {
  /**
   * Create a Researcher
   * @param {Object} opts
   * @param {string} opts.id - unique id for the researcher
   * @param {string} opts.name - researcher name
   * @param {string} opts.email - researcher email
   * @param {string} [opts.apiKey=''] - API Key (assigned when SLA is assigned)
   */
  constructor(opts = {}) {
    if (!opts || typeof opts !== 'object') {
      throw new TypeError('Researcher constructor expects an options object');
    }

    const { id, name, email, apiKey = '' } = opts;

    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError('Researcher.id must be a non-empty string');
    }
    if (typeof name !== 'string' || name.length === 0) {
      throw new TypeError('Researcher.name must be a non-empty string');
    }
    if (typeof email !== 'string' || email.length === 0) {
      throw new TypeError('Researcher.email must be a non-empty string');
    }

    this.id = id;
    this.name = name;
    this.email = email;
    this.apiKey = apiKey;
  }

  /**
   * Convert to plain object for storage
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      apiKey: this.apiKey
    };
  }

  /**
   * Create a Researcher from a plain object
   */
  static fromJSON(obj) {
    return new Researcher({
      id: obj.id,
      name: obj.name,
      email: obj.email,
      apiKey: obj.apiKey || ''
    });
  }
}

module.exports = Researcher;
