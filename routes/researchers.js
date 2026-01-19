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
 *     summary: Create a new researcher
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
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *                 description: Researcher name
 *               email:
 *                 type: string
 *                 description: Researcher email
 *           examples:
 *             minimal:
 *               summary: Minimal payload
 *               value:
 *                 name: "Ada Lovelace"
 *                 email: "ada@example.org"
 *     responses:
 *       '200':
 *         description: Researcher created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 researcher:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     apiKey:
 *                       type: string
 *             examples:
 *               created:
 *                 summary: Created researcher response
 *                 value:
 *                   success: true
 *                   message: "Researcher created successfully"
 *                   researcher:
 *                     id: "b6f2f839e4f34bfc9a0a9f4a3f0d9f52"
 *                     name: "Ada Lovelace"
 *                     email: "ada@example.org"
 *                     apiKey: "a1b2c3d4e5f6..."
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
    
    // Generate unique ID for the researcher and an API key
    const researcherId = crypto.randomBytes(16).toString('hex');
    const apiKeyId = crypto.randomBytes(32).toString('hex');

    // Create API key document
    await apiKeyStore.addAPIKey(apiKeyId, { id: apiKeyId, slas: [] });

    const researcher = new Researcher({
      id: researcherId,
      name: name,
      email: email,
      apiKey: apiKeyId
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
 *     summary: Retrieve a researcher by id
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 researcher:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     apiKey:
 *                       type: string
 *             examples:
 *               example:
 *                 summary: Example researcher
 *                 value:
 *                   success: true
 *                   message: "Researcher retrieved successfully"
 *                   researcher:
 *                     id: "e1d2c3b4a5f6..."
 *                     name: "Alan Turing"
 *                     email: "alan@example.org"
 *                     apiKey: "k9j8h7g6f5..."
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 count:
 *                   type: integer
 *                 researchers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       apiKey:
 *                         type: string
 *             examples:
 *               list:
 *                 summary: Example list response
 *                 value:
 *                   success: true
 *                   message: "Researchers retrieved successfully"
 *                   count: 2
 *                   researchers:
 *                     - id: "id-1"
 *                       name: "Ada Lovelace"
 *                       email: "ada@example.org"
 *                       apiKey: "key-1"
 *                     - id: "id-2"
 *                       name: "Alan Turing"
 *                       email: "alan@example.org"
 *                       apiKey: "key-2"
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
 *     summary: Update a researcher
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
 *               email:
 *                 type: string
 *           examples:
 *             updateName:
 *               summary: Update name only
 *               value:
 *                 name: "Grace Hopper"
 *             updateEmail:
 *               summary: Update email only
 *               value:
 *                 email: "grace@example.org"
 *     responses:
 *       '200':
 *         description: Researcher updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 researcher:
 *                   type: object
 *             examples:
 *               updated:
 *                 summary: Example update response
 *                 value:
 *                   success: true
 *                   message: "Researcher updated successfully"
 *                   researcher:
 *                     id: "id-1"
 *                     name: "Grace Hopper"
 *                     email: "grace@example.org"
 *                     apiKey: "key-1"
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
 *     summary: Assign an SLA to a researcher (via API key)
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
 *               summary: Assign a priority SLA
 *               value:
 *                 slaId: "sla-priority"
 *     responses:
 *       '200':
 *         description: SLA assigned successfully and researcher updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 researcher:
 *                   type: object
 *             examples:
 *               assigned:
 *                 summary: Example assign response
 *                 value:
 *                   success: true
 *                   message: "SLA assigned to researcher successfully"
 *                   researcher:
 *                     id: "id-1"
 *                     name: "Ada Lovelace"
 *                     email: "ada@example.org"
 *                     apiKey: "key-1"
 *       '400':
 *         description: Missing required fields
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
 *     summary: Remove an SLA from a researcher (via API key)
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
 *         description: SLA removed successfully and researcher updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 researcher:
 *                   type: object
 *             examples:
 *               removed:
 *                 summary: Example removal response
 *                 value:
 *                   success: true
 *                   message: "SLA removed from researcher successfully"
 *                   researcher:
 *                     id: "id-1"
 *                     name: "Alan Turing"
 *                     email: "alan@example.org"
 *                     apiKey: "key-1"
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *             examples:
 *               deleted:
 *                 summary: Example deletion response
 *                 value:
 *                   success: true
 *                   message: "Researcher deleted successfully"
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
