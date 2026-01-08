const express = require('express');
const respond = require('../utils/response');

const router = express.Router();

/**
 * @openapi
 * /api/slas:
 *   get:
 *     summary: List SLAs
 *     tags:
 *       - SLAs
 *     responses:
 *       '200':
 *         description: List of SLAs (stub)
 */
// Obtain the list of SLAs
router.get('/', (req, res) => {
  return respond.success(res, {
    message: 'SLAs list (stub)',
    items: []
  });
});


/**
 * @openapi
 * /api/slas/templates:
 *   get:
 *     summary: List SLA templates
 *     tags:
 *       - SLAs
 *     responses:
 *       '200':
 *         description: List of SLA templates (stub)
 */
// Obtain the list of SLA templates
router.get('/templates', (req, res) => {
  return respond.success(res, {
    message: 'SLA templates list (stub)',
    items: []
  });
});

/**
 * @openapi
 * /api/slas/templates/{id}:
 *   get:
 *     summary: Get SLA template by id
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
 *         description: SLA template info (stub)
 */
// Obtain a SLA template
router.get('/templates/:id', (req, res) => {
  return respond.success(res, {
    message: 'SLA template info (stub)',
    id: req.params.id
  });
});

/**
 * @openapi
 * /api/slas/{id}:
 *   get:
 *     summary: Get SLA by id
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
 *         description: SLA info (stub)
 */
// Obtain an SLA
router.get('/:id', (req, res) => {
  return respond.success(res, {
    message: 'SLA info (stub)',
    id: req.params.id
  });
});
/**
 * @openapi
 * /api/slas:
 *   post:
 *     summary: Upload an SLA from a YAML file path
 *     description: |
 *       Accepts either a JSON object with a `path`/`yamlPath` string, or a raw JSON string representing the file path.
 *       Note: When the server uses the default `express.json({ strict: true })`, raw string bodies may be rejected.
 *       Prefer sending `{ "path": "C:\\path\\to\\file.yaml" }`.
 *     tags:
 *       - SLAs
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: string
 *                 description: Absolute or relative path to the YAML file
 *               - type: object
 *                 properties:
 *                   path:
 *                     type: string
 *                   yamlPath:
 *                     type: string
 *           examples:
 *             objectForm:
 *               summary: Object form
 *               value:
 *                 path: "C:\\temp\\example.yaml"
 *             stringForm:
 *               summary: Raw JSON string form
 *               value: "C:\\temp\\example.yaml"
 *     responses:
 *       '200':
 *         description: SLA uploaded (stub)
 */
// Upload a SLA (expects body to be a string or object containing a path)
router.post('/', (req, res) => {
  const body = req.body;
  const yamlPath = typeof body === 'string' ? body : (body && (body.path || body.yamlPath)) || null;
  return respond.success(res, {
    message: 'SLA uploaded (stub)',
    yamlPath
  });
});

/**
 * @openapi
 * /api/slas/{id}:
 *   delete:
 *     summary: Remove an SLA
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
 *         description: SLA removed (stub)
 */
// Remove a SLA
router.delete('/:id', (req, res) => {
  return respond.success(res, {
    message: 'SLA removed (stub)',
    id: req.params.id
  });
});

/**
 * @openapi
 * /api/slas/templates:
 *   post:
 *     summary: Upload an SLA template from a YAML file path
 *     description: |
 *       Accepts either a JSON object with a `path`/`yamlPath` string, or a raw JSON string representing the file path.
 *       Note: When the server uses the default `express.json({ strict: true })`, raw string bodies may be rejected.
 *       Prefer sending `{ "path": "C:\\path\\to\\template.yaml" }`.
 *     tags:
 *       - SLAs
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: string
 *                 description: Absolute or relative path to the template YAML file
 *               - type: object
 *                 properties:
 *                   path:
 *                     type: string
 *                   yamlPath:
 *                     type: string
 *           examples:
 *             objectForm:
 *               summary: Object form
 *               value:
 *                 path: "C:\\temp\\template.yaml"
 *             stringForm:
 *               summary: Raw JSON string form
 *               value: "C:\\temp\\template.yaml"
 *     responses:
 *       '200':
 *         description: SLA template uploaded (stub)
 */
// Upload a SLA template
router.post('/templates', (req, res) => {
  const body = req.body;
  const templatePath = typeof body === 'string' ? body : (body && (body.path || body.yamlPath)) || null;
  return respond.success(res, {
    message: 'SLA template uploaded (stub)',
    templatePath
  });
});

/**
 * @openapi
 * /api/slas/templates/{id}:
 *   delete:
 *     summary: Remove an SLA template
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
 *         description: SLA template removed (stub)
 */
router.delete('/templates/:id', (req, res) => {
  return respond.success(res, {
    message: 'SLA template removed (stub)',
    id: req.params.id
  });
});

/**
 * @openapi
 * /api/slas/from-template:
 *   post:
 *     summary: Create an SLA from a template
 *     description: No assumptions on how the SLA is generated; payload is flexible.
 *     tags:
 *       - SLAs
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *           examples:
 *             fromTemplate:
 *               value:
 *                 templateId: "tmpl-1"
 *                 variables:
 *                   project: "example"
 *     responses:
 *       '200':
 *         description: SLA created from template (stub)
 */
// Create a SLA from a template (no assumptions)
router.post('/from-template', (req, res) => {
  return respond.success(res, {
    message: 'SLA created from template (stub)',
    payload: req.body || null
  });
});

/**
 * @openapi
 * /api/slas/{id}/validate:
 *   post:
 *     summary: Validate that an SLA functions
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
 *         description: SLA validation triggered (stub)
 */
// Validate that a SLA functions
router.post('/:id/validate', (req, res) => {
  return respond.success(res, {
    message: 'SLA validation triggered (stub)',
    id: req.params.id
  });
});

module.exports = router;
