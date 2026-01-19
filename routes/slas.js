const express = require('express');
const respond = require('../utils/response');
const crypto = require('crypto');
const SLA = require('../models/sla');
const SLATemplate = require('../models/slaTemplate');
const slaStore = require('../services/slaStore');
const slaTemplateStore = require('../services/slaTemplateStore');
const apiKeyStore = require('../services/apiKeyStore');

const router = express.Router();

// Helper: check expiry and auto-expire if necessary
async function checkAndExpireIfNeeded(slaDoc) {
  if (!slaDoc) return null;
  const instance = SLA.fromJSON({
    id: slaDoc.id || slaDoc._id,
    filepath: slaDoc.filepath,
    apiKey: slaDoc.apiKey,
    templateId: slaDoc.templateId,
    validity: slaDoc.validity,
    expiryDate: slaDoc.expiryDate
  });

  const expired = instance.isExpired();
  if (expired && slaDoc.validity === true) {
  /**
   * POST /api/slas/templates - create SLA template
   *
   * @openapi
   * /api/slas/templates:
   *   post:
   *     summary: Create an SLA template
   *     tags:
   *       - SLA Templates
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               filepath:
   *                 type: string
   *                 description: Absolute or workspace-relative path to the SLA YAML file
   *           examples:
   *             createTemplate:
   *               summary: Example body to create a template
   *               value:
   *                 filepath: "docs/templates/sla_gpu.yaml"
   *     responses:
   *       '200':
   *         description: SLA template created
   *       '400':
   *         description: Missing or invalid payload
   */
    // expire it in storage
    await slaStore.updateSLA(slaDoc._id || slaDoc.id, { validity: false });
    const updated = await slaStore.findSLA(slaDoc._id || slaDoc.id);
    return updated;
  }
  // Return normalized JSON reflecting current validity
  return instance.toJSON();
}

/** Templates CRUD **/

// Create SLA template
router.post('/templates', async (req, res) => {
  try {
    const filepath = req.body?.filepath || req.body?.path || req.body?.yamlPath || (typeof req.body === 'string' ? req.body : null);
    if (!filepath) return respond.error(res, 'filepath is required', 400);
    const id = crypto.randomBytes(16).toString('hex');
    const tmpl = new SLATemplate({ id, filepath });
    await slaTemplateStore.addTemplate(id, tmpl.toJSON());
    return respond.success(res, { message: 'SLA template created', template: tmpl.toJSON() });
  } catch (err) {
    console.error('Create template error:', err);
    return respond.error(res, 'Failed to create template: ' + err.message);
  }
});

// Read SLA template
router.get('/templates/:id', async (req, res) => {
  try {
    const doc = await slaTemplateStore.findTemplate(req.params.id);
    if (!doc) return respond.error(res, 'Template not found', 404);
    return respond.success(res, { message: 'Template retrieved', template: doc });
  } catch (err) {
    console.error('Get template error:', err);
    return respond.error(res, 'Failed to get template: ' + err.message);
  }
});

// List templates
router.get('/templates', async (req, res) => {
  try {
    const docs = await slaTemplateStore.getAll();
    return respond.success(res, { message: 'Templates retrieved', count: docs.length, templates: docs });
  } catch (err) {
    console.error('List templates error:', err);
    return respond.error(res, 'Failed to list templates: ' + err.message);
  }
});

// Update template filepath
router.put('/templates/:id', async (req, res) => {
  try {
    const filepath = req.body?.filepath || req.body?.path || req.body?.yamlPath || (typeof req.body === 'string' ? req.body : null);
    if (!filepath) return respond.error(res, 'filepath is required', 400);
    const updated = await slaTemplateStore.updateTemplate(req.params.id, { filepath });
    return respond.success(res, { message: 'Template updated', template: updated });
  } catch (err) {
    console.error('Update template error:', err);
    if (err.message === 'Template not found') return respond.error(res, err.message, 404);
    return respond.error(res, 'Failed to update template: ' + err.message);
  }
});

// Delete template
router.delete('/templates/:id', async (req, res) => {
/**
 * GET /api/slas/templates/{id} - get SLA template by id
 *
 * @openapi
 * /api/slas/templates/{id}:
 *   get:
 *     summary: Retrieve an SLA template
 *     tags:
 *       - SLA Templates
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Template retrieved
 *       '404':
 *         description: Template not found
 */
  try {
    const numRemoved = await slaTemplateStore.removeTemplate(req.params.id);
    if (numRemoved === 0) return respond.error(res, 'Template not found', 404);
    return respond.success(res, { message: 'Template deleted' });
  } catch (err) {
    console.error('Delete template error:', err);
    return respond.error(res, 'Failed to delete template: ' + err.message);
  }
});

/** SLAs CRUD and operations **/
/**
 * GET /api/slas/templates - list SLA templates
 *
 * @openapi
 * /api/slas/templates:
 *   get:
 *     summary: List all SLA templates
 *     tags:
 *       - SLA Templates
 *     responses:
 *       '200':
 *         description: A list of templates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 templates:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       filepath:
 *                         type: string
 */

// Create SLA
router.post('/', async (req, res) => {
  try {
    const { filepath, apiKey, templateId } = req.body || {};
    let { validity, expiryDate } = req.body || {};
    if (!filepath || !apiKey || !templateId) {
      return respond.error(res, 'filepath, apiKey and templateId are required', 400);
    }
    // ensure apiKey exists
/**
 * PUT /api/slas/templates/{id} - update SLA template filepath
 *
 * @openapi
 * /api/slas/templates/{id}:
 *   put:
 *     summary: Update an SLA template
 *     tags:
 *       - SLA Templates
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
 *               filepath:
 *                 type: string
 *           examples:
 *             updateTemplate:
 *               summary: Example body to update a template
 *               value:
 *                 filepath: "docs/templates/sla_gpu_v2.yaml"
 *     responses:
 *       '200':
 *         description: Template updated
 *       '400':
 *         description: Missing or invalid payload
 *       '404':
 *         description: Template not found
 */
    const apiKeyDoc = await apiKeyStore.findAPIKey(apiKey);
    if (!apiKeyDoc) return respond.error(res, 'API Key not found', 400);
    // optional: ensure template exists
    const templateDoc = await slaTemplateStore.findTemplate(templateId);
    if (!templateDoc) return respond.error(res, 'Template not found', 400);

    // defaults
    if (validity === undefined) validity = true;
    if (!expiryDate) {
      const now = new Date();
      const monthLater = new Date(now.getTime());
      monthLater.setMonth(monthLater.getMonth() + 1);
      expiryDate = monthLater.toISOString();
/**
 * DELETE /api/slas/templates/{id} - remove an SLA template
 *
 * @openapi
 * /api/slas/templates/{id}:
 *   delete:
 *     summary: Delete an SLA template
 *     tags:
 *       - SLA Templates
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Template deleted
 *       '404':
 *         description: Template not found
 */
    }

    const id = crypto.randomBytes(16).toString('hex');
    const instance = new SLA({ id, filepath, apiKey, templateId, validity, expiryDate });
    await slaStore.addSLA(id, instance.toJSON());

    // Assign SLA to the API key owner automatically
    // Update API key store to include this SLA id
    const slas = Array.isArray(apiKeyDoc.slas) ? apiKeyDoc.slas : [];
    if (!slas.includes(id)) {
      slas.push(id);
      await apiKeyStore.updateAPIKey(apiKey, { slas });
    }
/**
 * POST /api/slas - create a new SLA
 *
 * @openapi
 * /api/slas:
 *   post:
 *     summary: Create a new SLA
 *     tags:
 *       - SLAs
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - filepath
 *               - apiKey
 *               - templateId
 *             properties:
 *               filepath:
 *                 type: string
 *               apiKey:
 *                 type: string
 *               templateId:
 *                 type: string
 *               validity:
 *                 type: boolean
 *                 description: Optional; defaults to true
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *                 description: Optional; defaults to one month ahead
 *           examples:
 *             createSLA:
 *               summary: Example body to create an SLA
 *               value:
 *                 filepath: "docs/slas/user_sla.yaml"
 *                 apiKey: "abc123"
 *                 templateId: "tmpl_01"
 *                 validity: true
 *     responses:
 *       '200':
 *         description: SLA created
 *       '400':
 *         description: Invalid payload or missing references
 */

    return respond.success(res, { message: 'SLA created', sla: instance.toJSON() });
  } catch (err) {
    console.error('Create SLA error:', err);
    return respond.error(res, 'Failed to create SLA: ' + err.message);
  }
});

// Get SLA by id (checking expiry)
router.get('/:id', async (req, res) => {
  try {
    const doc = await slaStore.findSLA(req.params.id);
    if (!doc) return respond.error(res, 'SLA not found', 404);
    const updatedOrNormalized = await checkAndExpireIfNeeded(doc);
    return respond.success(res, { message: 'SLA retrieved', sla: updatedOrNormalized });
  } catch (err) {
    console.error('Get SLA error:', err);
    return respond.error(res, 'Failed to get SLA: ' + err.message);
  }
});

// List SLAs given an API key
router.get('/by-apiKey/:apiKey', async (req, res) => {
  try {
    const docs = await slaStore.findByApiKey(req.params.apiKey);
    const results = [];
    for (const d of docs) {
      const u = await checkAndExpireIfNeeded(d);
      results.push(u);
    }
    return respond.success(res, { message: 'SLAs by API key', count: results.length, slas: results });
    /**
     * GET /api/slas/{id} - get SLA by id
     *
     * @openapi
     * /api/slas/{id}:
     *   get:
     *     summary: Retrieve an SLA by id
     *     tags:
     *       - SLAs
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       '200':
     *         description: SLA retrieved
     *       '404':
     *         description: SLA not found
     */
  } catch (err) {
    console.error('List SLAs by key error:', err);
    return respond.error(res, 'Failed to list SLAs by API key: ' + err.message);
  }
});

// List all SLAs
router.get('/', async (req, res) => {
  try {
    const docs = await slaStore.getAll();
    const results = [];
    for (const d of docs) {
    /**
     * GET /api/slas/by-apiKey/{apiKey} - list SLAs linked to an API key
     *
     * @openapi
     * /api/slas/by-apiKey/{apiKey}:
     *   get:
     *     summary: List SLAs by API key
     *     tags:
     *       - SLAs
     *     parameters:
     *       - in: path
     *         name: apiKey
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       '200':
     *         description: SLAs retrieved for the given key
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 count:
     *                   type: integer
     *                 slas:
     *                   type: array
     *                   items:
     *                     type: object
     */
      const u = await checkAndExpireIfNeeded(d);
      results.push(u);
    }
    return respond.success(res, { message: 'SLAs retrieved', count: results.length, slas: results });
  } catch (err) {
    console.error('List SLAs error:', err);
    return respond.error(res, 'Failed to list SLAs: ' + err.message);
  }
});

// Modify data of an SLA
router.put('/:id', async (req, res) => {
  try {
    const existing = await slaStore.findSLA(req.params.id);
    if (!existing) return respond.error(res, 'SLA not found', 404);
    /**
     * GET /api/slas - list all SLAs
     *
     * @openapi
     * /api/slas:
     *   get:
     *     summary: List all SLAs
     *     tags:
     *       - SLAs
     *     responses:
     *       '200':
     *         description: A list of SLAs
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 count:
     *                   type: integer
     *                 slas:
     *                   type: array
     *                   items:
     *                     type: object
     */

    const updates = {};
    const allowed = ['filepath', 'apiKey', 'templateId', 'validity', 'expiryDate'];
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }

    // If apiKey changes, move SLA id between API keys
    if (updates.apiKey && updates.apiKey !== existing.apiKey) {
      const newKeyDoc = await apiKeyStore.findAPIKey(updates.apiKey);
      if (!newKeyDoc) return respond.error(res, 'New API Key not found', 400);
      const oldKeyDoc = await apiKeyStore.findAPIKey(existing.apiKey);
      if (oldKeyDoc) {
        const s = Array.isArray(oldKeyDoc.slas) ? oldKeyDoc.slas : [];
        const idx = s.indexOf(existing._id || req.params.id);
    /**
     * PUT /api/slas/{id} - update an SLA (partial)
     *
     * @openapi
     * /api/slas/{id}:
     *   put:
     *     summary: Update an existing SLA
     *     tags:
     *       - SLAs
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
     *               filepath:
     *                 type: string
     *               apiKey:
     *                 type: string
     *               templateId:
     *                 type: string
     *               validity:
     *                 type: boolean
     *               expiryDate:
     *                 type: string
     *                 format: date-time
     *           examples:
     *             updateSLA:
     *               summary: Example body to update an SLA
     *               value:
     *                 validity: false
     *                 expiryDate: "2026-02-01T12:00:00Z"
     *     responses:
     *       '200':
     *         description: SLA updated
     *       '400':
     *         description: Invalid update or missing references
     *       '404':
     *         description: SLA not found
     */
        if (idx > -1) s.splice(idx, 1);
        await apiKeyStore.updateAPIKey(existing.apiKey, { slas: s });
      }
      const s2 = Array.isArray(newKeyDoc.slas) ? newKeyDoc.slas : [];
      if (!s2.includes(existing._id || req.params.id)) s2.push(existing._id || req.params.id);
      await apiKeyStore.updateAPIKey(updates.apiKey, { slas: s2 });
    }

    // If templateId is updated, optional validation that it exists
    if (updates.templateId) {
      const tmpl = await slaTemplateStore.findTemplate(updates.templateId);
      if (!tmpl) return respond.error(res, 'Template not found', 400);
    }

    const updated = await slaStore.updateSLA(req.params.id, updates);
    const normalized = await checkAndExpireIfNeeded(updated);
    return respond.success(res, { message: 'SLA updated', sla: normalized });
  } catch (err) {
    console.error('Update SLA error:', err);
    if (err.message === 'SLA not found') return respond.error(res, err.message, 404);
    return respond.error(res, 'Failed to update SLA: ' + err.message);
  }
});

// Check if SLA has expired
router.get('/:id/check-expiry', async (req, res) => {
  try {
    const doc = await slaStore.findSLA(req.params.id);
    if (!doc) return respond.error(res, 'SLA not found', 404);
    const instance = SLA.fromJSON({
      id: doc.id || doc._id,
      filepath: doc.filepath,
      apiKey: doc.apiKey,
      templateId: doc.templateId,
      validity: doc.validity,
    /**
     * GET /api/slas/{id}/check-expiry - check whether an SLA has expired
     *
     * @openapi
     * /api/slas/{id}/check-expiry:
     *   get:
     *     summary: Check if an SLA has expired
     *     tags:
     *       - SLAs
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       '200':
     *         description: Expiry status returned
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 expired:
     *                   type: boolean
     *                 currentlyValid:
     *                   type: boolean
     *       '404':
     *         description: SLA not found
     */
      expiryDate: doc.expiryDate
    });
    const expired = instance.isExpired();
    return respond.success(res, { message: 'SLA expiry checked', expired, currentlyValid: instance.isValid() });
  } catch (err) {
    console.error('Check expiry error:', err);
    return respond.error(res, 'Failed to check expiry: ' + err.message);
  }
});

// Expire an SLA (validity = false)
router.post('/:id/expire', async (req, res) => {
  try {
    const doc = await slaStore.findSLA(req.params.id);
    if (!doc) return respond.error(res, 'SLA not found', 404);
    if (doc.validity === false) {
      return respond.success(res, { message: 'SLA already expired', sla: doc });
    }
    const updated = await slaStore.updateSLA(req.params.id, { validity: false });
    return respond.success(res, { message: 'SLA expired', sla: updated });
    /**
     * POST /api/slas/{id}/expire - mark an SLA as expired
     *
     * @openapi
     * /api/slas/{id}/expire:
     *   post:
     *     summary: Expire an SLA (set validity=false)
     *     tags:
     *       - SLAs
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       '200':
     *         description: SLA expired
     *       '404':
     *         description: SLA not found
     */
  } catch (err) {
    console.error('Expire SLA error:', err);
    return respond.error(res, 'Failed to expire SLA: ' + err.message);
  }
});

// Delete SLA
router.delete('/:id', async (req, res) => {
  try {
    const doc = await slaStore.findSLA(req.params.id);
    if (!doc) return respond.error(res, 'SLA not found', 404);
    // remove from api key slas list
    const keyDoc = await apiKeyStore.findAPIKey(doc.apiKey);
    if (keyDoc) {
      const s = Array.isArray(keyDoc.slas) ? keyDoc.slas : [];
    /**
     * DELETE /api/slas/{id} - delete an SLA
     *
     * @openapi
     * /api/slas/{id}:
     *   delete:
     *     summary: Delete an SLA
     *     tags:
     *       - SLAs
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       '200':
     *         description: SLA deleted
     *       '404':
     *         description: SLA not found
     */
      const idx = s.indexOf(doc._id || req.params.id);
      if (idx > -1) s.splice(idx, 1);
      await apiKeyStore.updateAPIKey(doc.apiKey, { slas: s });
    }
    await slaStore.removeSLA(req.params.id);
    return respond.success(res, { message: 'SLA deleted' });
  } catch (err) {
    console.error('Delete SLA error:', err);
    return respond.error(res, 'Failed to delete SLA: ' + err.message);
  }
});

module.exports = router;

module.exports = router;
