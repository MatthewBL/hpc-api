const express = require('express');
const respond = require('../utils/response');
const researcherStore = require('../services/researcherStore');
const apiKeyStore = require('../services/apiKeyStore');
const Researcher = require('../models/researcher');
const crypto = require('crypto');

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
 *         description: Researcher created successfully
 *       '400':
 *         description: Missing required fields
 *       '500':
 *         description: Server error
 */
// Create researcher
router.post('/', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return respond.error(res, 'Name and email are required', 400);
    }
    
    // Generate unique ID for the researcher
    const researcherId = crypto.randomBytes(16).toString('hex');
    
    const researcher = new Researcher({
      id: researcherId,
      name: name,
      email: email,
      apiKey: '' // No API key until an SLA is assigned
    });
    
    await researcherStore.addResearcher(researcherId, researcher.toJSON());
    
    return respond.success(res, {
      message: 'Researcher created successfully',
      researcher: researcher.toJSON()
    });
  } catch (error) {
    console.error('Error creating researcher:', error);
    return respond.error(res, 'Failed to create researcher: ' + error.message);
  }
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
 *         description: Researcher information
 *       '404':
 *         description: Researcher not found
 *       '500':
 *         description: Server error
 */
// Obtain information of a researcher
router.get('/:id', async (req, res) => {
  try {
    const researcherDoc = await researcherStore.findResearcher(req.params.id);
    
    if (!researcherDoc) {
      return respond.error(res, 'Researcher not found', 404);
    }
    
    return respond.success(res, {
      message: 'Researcher retrieved successfully',
      researcher: researcherDoc
    });
  } catch (error) {
    console.error('Error retrieving researcher:', error);
    return respond.error(res, 'Failed to retrieve researcher: ' + error.message);
  }
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
 *         description: List of researchers
 *       '500':
 *         description: Server error
 */
// List researchers
router.get('/', async (req, res) => {
  try {
    const researchers = await researcherStore.getAll();
    
    return respond.success(res, {
      message: 'Researchers retrieved successfully',
      count: researchers.length,
      researchers: researchers
    });
  } catch (error) {
    console.error('Error listing researchers:', error);
    return respond.error(res, 'Failed to list researchers: ' + error.message);
  }
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
 *         description: Researcher modified successfully
 *       '404':
 *         description: Researcher not found
 *       '500':
 *         description: Server error
 */
// Modify a researcher
router.put('/:id', async (req, res) => {
  try {
    const researcherDoc = await researcherStore.findResearcher(req.params.id);
    
    if (!researcherDoc) {
      return respond.error(res, 'Researcher not found', 404);
    }
    
    const updates = {};
    if (req.body.name !== undefined) {
      updates.name = req.body.name;
    }
    if (req.body.email !== undefined) {
      updates.email = req.body.email;
    }
    // Note: id and apiKey cannot be modified through this endpoint
    
    const updated = await researcherStore.updateResearcher(req.params.id, updates);
    
    return respond.success(res, {
      message: 'Researcher updated successfully',
      researcher: updated
    });
  } catch (error) {
    console.error('Error updating researcher:', error);
    return respond.error(res, 'Failed to update researcher: ' + error.message);
  }
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
 *         description: SLA assigned successfully
 *       '400':
 *         description: Missing required fields or researcher has no API key
 *       '404':
 *         description: Researcher not found
 *       '500':
 *         description: Server error
 */
// Assign an SLA to a researcher
router.post('/:id/slas', async (req, res) => {
  try {
    const { slaId } = req.body;
    
    if (!slaId) {
      return respond.error(res, 'slaId is required', 400);
    }
    
    const researcherDoc = await researcherStore.findResearcher(req.params.id);
    
    if (!researcherDoc) {
      return respond.error(res, 'Researcher not found', 404);
    }
    
    // If researcher doesn't have an API key, create one
    let apiKeyId = researcherDoc.apiKey;
    if (!apiKeyId) {
      // Generate a new API key
      apiKeyId = crypto.randomBytes(32).toString('hex');
      
      // Create the API key in the store
      await apiKeyStore.addAPIKey(apiKeyId, {
        id: apiKeyId,
        slas: [slaId]
      });
      
      // Update the researcher with the new API key
      await researcherStore.updateResearcher(req.params.id, { apiKey: apiKeyId });
    } else {
      // API key exists, just add the SLA to it
      await apiKeyStore.addSLAToAPIKey(apiKeyId, slaId);
    }
    
    // Get updated researcher
    const updatedResearcher = await researcherStore.findResearcher(req.params.id);
    
    return respond.success(res, {
      message: 'SLA assigned to researcher successfully',
      researcher: updatedResearcher
    });
  } catch (error) {
    console.error('Error assigning SLA to researcher:', error);
    return respond.error(res, 'Failed to assign SLA: ' + error.message);
  }
});

/**
 * @openapi
 * /api/researchers/{id}/slas/{slaId}:
 *   delete:
 *     summary: Remove an SLA from a researcher
 *     tags:
 *       - Researchers
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: slaId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: SLA removed successfully
 *       '400':
 *         description: Researcher has no API key
 *       '404':
 *         description: Researcher not found
 *       '500':
 *         description: Server error
 */
// Remove an SLA from a researcher
router.delete('/:id/slas/:slaId', async (req, res) => {
  try {
    const researcherDoc = await researcherStore.findResearcher(req.params.id);
    
    if (!researcherDoc) {
      return respond.error(res, 'Researcher not found', 404);
    }
    
    if (!researcherDoc.apiKey) {
      return respond.error(res, 'Researcher has no API key', 400);
    }
    
    // Remove the SLA from the API key
    await apiKeyStore.removeSLAFromAPIKey(researcherDoc.apiKey, req.params.slaId);
    
    // Get updated researcher
    const updatedResearcher = await researcherStore.findResearcher(req.params.id);
    
    return respond.success(res, {
      message: 'SLA removed from researcher successfully',
      researcher: updatedResearcher
    });
  } catch (error) {
    console.error('Error removing SLA from researcher:', error);
    return respond.error(res, 'Failed to remove SLA: ' + error.message);
  }
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
 *         description: Researcher removed successfully
 *       '404':
 *         description: Researcher not found
 *       '500':
 *         description: Server error
 */
// Remove a researcher
router.delete('/:id', async (req, res) => {
  try {
    const researcherDoc = await researcherStore.findResearcher(req.params.id);
    
    if (!researcherDoc) {
      return respond.error(res, 'Researcher not found', 404);
    }
    
    // If researcher has an API key, remove it too
    if (researcherDoc.apiKey) {
      await apiKeyStore.removeAPIKey(researcherDoc.apiKey);
    }
    
    const numRemoved = await researcherStore.removeResearcher(req.params.id);
    
    return respond.success(res, {
      message: 'Researcher deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting researcher:', error);
    return respond.error(res, 'Failed to delete researcher: ' + error.message);
  }
});

module.exports = router;
