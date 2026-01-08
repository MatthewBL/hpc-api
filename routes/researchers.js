const express = require('express');
const respond = require('../utils/response');

const router = express.Router();

/**
 * @openapi
 * /api/researchers:
 *   post:
 *     summary: Create researcher
 *     tags:
 *       - Researchers
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Researcher name
 *               slas:
 *                 type: array
 *                 description: List of SLA identifiers applied to the researcher
 *                 items:
 *                   type: string
 *           examples:
 *             minimal:
 *               summary: Minimal example
 *               value:
 *                 name: "Ada Lovelace"
 *             withSlas:
 *               summary: With SLAs
 *               value:
 *                 name: "Alan Turing"
 *                 slas: ["sla-basic", "sla-priority"]
 *     responses:
 *       '200':
 *         description: Researcher created (stub)
 */
// Create researcher
router.post('/', (req, res) => {
  return respond.success(res, {
    message: 'Researcher created (stub)'.trim(),
    payload: req.body || null
  });
});

/**
 * @openapi
 * /api/researchers/{id}:
 *   get:
 *     summary: Get researcher by id
 *     tags:
 *       - Researchers
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Researcher info (stub)
 */
// Obtain information of a researcher
router.get('/:id', (req, res) => {
  return respond.success(res, {
    message: 'Researcher info (stub)',
    id: req.params.id
  });
});

/**
 * @openapi
 * /api/researchers:
 *   get:
 *     summary: List researchers
 *     tags:
 *       - Researchers
 *     responses:
 *       '200':
 *         description: List of researchers (stub)
 */
// List researchers
router.get('/', (req, res) => {
  return respond.success(res, {
    message: 'Researchers list (stub)',
    items: []
  });
});

/**
 * @openapi
 * /api/researchers/{id}:
 *   put:
 *     summary: Modify a researcher
 *     tags:
 *       - Researchers
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
 *               name:
 *                 type: string
 *               slas:
 *                 type: array
 *                 items:
 *                   type: string
 *           examples:
 *             updateName:
 *               summary: Update name only
 *               value:
 *                 name: "Grace Hopper"
 *             updateSlas:
 *               summary: Update SLAs
 *               value:
 *                 slas: ["sla-basic"]
 *     responses:
 *       '200':
 *         description: Researcher modified (stub)
 */
// Modify a researcher
router.put('/:id', (req, res) => {
  return respond.success(res, {
    message: 'Researcher modified (stub)',
    id: req.params.id,
    payload: req.body || null
  });
});

/**
 * @openapi
 * /api/researchers/{id}/slas:
 *   post:
 *     summary: Assign an SLA to a researcher
 *     tags:
 *       - Researchers
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
 *             required:
 *               - slaId
 *             properties:
 *               slaId:
 *                 type: string
 *                 description: SLA identifier to assign
 *           examples:
 *             assign:
 *               value:
 *                 slaId: "sla-priority"
 *     responses:
 *       '200':
 *         description: SLA assigned (stub)
 */
// Assign an SLA to a researcher
router.post('/:id/slas', (req, res) => {
  return respond.success(res, {
    message: 'SLA assigned to researcher (stub)',
    id: req.params.id,
    payload: req.body || null
  });
});

/**
 * @openapi
 * /api/researchers/{id}:
 *   delete:
 *     summary: Remove a researcher
 *     tags:
 *       - Researchers
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Researcher removed (stub)
 */
// Remove a researcher
router.delete('/:id', (req, res) => {
  return respond.success(res, {
    message: 'Researcher removed (stub)',
    id: req.params.id
  });
});

module.exports = router;
