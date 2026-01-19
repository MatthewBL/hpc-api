const express = require('express');
const respond = require('../utils/response');
const apiKeyStore = require('../services/apiKeyStore');
const APIKey = require('../models/apiKey');
const crypto = require('crypto');

const router = express.Router();

/**
 * @openapi
 * /api/apikeys:
 *   post:
 *     summary: Create API Key
 *     tags:
 *       - API Keys
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               slas:
 *                 type: array
 *                 description: List of SLA identifiers to assign to the API Key
 *                 items:
 *                   type: string
 *           examples:
 *             minimal:
 *               summary: Create API Key without SLAs
 *               value: {}
 *             withSlas:
 *               summary: Create API Key with SLAs
 *               value:
 *                 slas: ["sla-basic", "sla-priority"]
 *     responses:
 *       '200':
 *         description: API Key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 apiKey:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     slas:
 *                       type: array
 *                       items:
 *                         type: string
 *             examples:
 *               created:
 *                 summary: Example response after creation
 *                 value:
 *                   success: true
 *                   message: "API Key created successfully"
 *                   apiKey:
 *                     id: "1f2e3d4c..."
 *                     slas: ["sla-basic", "sla-priority"]
 *       '500':
 *         description: Server error
 */
router.post('/', async (req, res) => {
  try {
    // Generate a random API key
    const apiKeyId = crypto.randomBytes(32).toString('hex');
    const slas = req.body?.slas || [];
    
    const apiKey = new APIKey({
      id: apiKeyId,
      slas: slas
    });
    
    await apiKeyStore.addAPIKey(apiKeyId, apiKey.toJSON());
    
    return respond.success(res, {
      message: 'API Key created successfully',
      apiKey: apiKey.toJSON()
    });
  } catch (error) {
    console.error('Error creating API Key:', error);
    return respond.error(res, 'Failed to create API Key: ' + error.message);
  }
});

/**
 * @openapi
 * /api/apikeys/{id}:
 *   get:
 *     summary: Get API Key by id
 *     tags:
 *       - API Keys
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: API Key identifier
 *     responses:
 *       '200':
 *         description: API Key information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 apiKey:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     slas:
 *                       type: array
 *                       items:
 *                         type: string
 *             examples:
 *               found:
 *                 summary: Example response when API Key is found
 *                 value:
 *                   success: true
 *                   message: "API Key retrieved successfully"
 *                   apiKey:
 *                     id: "1f2e3d4c..."
 *                     slas: ["sla-basic"]
 *       '404':
 *         description: API Key not found
 *       '500':
 *         description: Server error
 */
router.get('/:id', async (req, res) => {
  try {
    const apiKeyDoc = await apiKeyStore.findAPIKey(req.params.id);
    
    if (!apiKeyDoc) {
      return respond.error(res, 'API Key not found', 404);
    }
    
    return respond.success(res, {
      message: 'API Key retrieved successfully',
      apiKey: apiKeyDoc
    });
  } catch (error) {
    console.error('Error retrieving API Key:', error);
    return respond.error(res, 'Failed to retrieve API Key: ' + error.message);
  }
});

/**
 * @openapi
 * /api/apikeys:
 *   get:
 *     summary: List all API Keys
 *     tags:
 *       - API Keys
 *     responses:
 *       '200':
 *         description: List of API Keys
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
 *                 apiKeys:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       slas:
 *                         type: array
 *                         items:
 *                           type: string
 *             examples:
 *               list:
 *                 summary: Example list response
 *                 value:
 *                   success: true
 *                   message: "API Keys retrieved successfully"
 *                   count: 2
 *                   apiKeys:
 *                     - id: "1f2e3d4c..."
 *                       slas: ["sla-basic"]
 *                     - id: "aabbccdd..."
 *                       slas: ["sla-premium", "sla-priority"]
 *       '500':
 *         description: Server error
 */
router.get('/', async (req, res) => {
  try {
    const apiKeys = await apiKeyStore.getAll();
    
    return respond.success(res, {
      message: 'API Keys retrieved successfully',
      count: apiKeys.length,
      apiKeys: apiKeys
    });
  } catch (error) {
    console.error('Error listing API Keys:', error);
    return respond.error(res, 'Failed to list API Keys: ' + error.message);
  }
});

/**
 * @openapi
 * /api/apikeys/{id}:
 *   put:
 *     summary: Update API Key
 *     tags:
 *       - API Keys
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
 *               slas:
 *                 type: array
 *                 description: Complete list of SLA identifiers
 *                 items:
 *                   type: string
 *           examples:
 *             updateSlas:
 *               summary: Update SLAs
 *               value:
 *                 slas: ["sla-basic", "sla-premium"]
 *     responses:
 *       '200':
 *         description: API Key updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 apiKey:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     slas:
 *                       type: array
 *                       items:
 *                         type: string
 *             examples:
 *               updated:
 *                 summary: Example response after update
 *                 value:
 *                   success: true
 *                   message: "API Key updated successfully"
 *                   apiKey:
 *                     id: "1f2e3d4c..."
 *                     slas: ["sla-basic", "sla-premium"]
 *       '404':
 *         description: API Key not found
 *       '500':
 *         description: Server error
 */
router.put('/:id', async (req, res) => {
  try {
    const apiKeyDoc = await apiKeyStore.findAPIKey(req.params.id);
    
    if (!apiKeyDoc) {
      return respond.error(res, 'API Key not found', 404);
    }
    
    const updates = {};
    if (req.body.slas !== undefined) {
      updates.slas = req.body.slas;
    }
    
    const updated = await apiKeyStore.updateAPIKey(req.params.id, updates);
    
    return respond.success(res, {
      message: 'API Key updated successfully',
      apiKey: updated
    });
  } catch (error) {
    console.error('Error updating API Key:', error);
    return respond.error(res, 'Failed to update API Key: ' + error.message);
  }
});

/**
 * @openapi
 * /api/apikeys/{id}/slas:
 *   post:
 *     summary: Assign an SLA to an API Key
 *     tags:
 *       - API Keys
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 apiKey:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     slas:
 *                       type: array
 *                       items:
 *                         type: string
 *             examples:
 *               assigned:
 *                 summary: Example response after SLA assignment
 *                 value:
 *                   success: true
 *                   message: "SLA assigned to API Key successfully"
 *                   apiKey:
 *                     id: "1f2e3d4c..."
 *                     slas: ["sla-basic", "sla-priority"]
 *       '404':
 *         description: API Key not found
 *       '500':
 *         description: Server error
 */
router.post('/:id/slas', async (req, res) => {
  try {
    const { slaId } = req.body;
    
    if (!slaId) {
      return respond.error(res, 'slaId is required', 400);
    }
    
    const updated = await apiKeyStore.addSLAToAPIKey(req.params.id, slaId);
    
    return respond.success(res, {
      message: 'SLA assigned to API Key successfully',
      apiKey: updated
    });
  } catch (error) {
    console.error('Error assigning SLA to API Key:', error);
    if (error.message === 'API Key not found') {
      return respond.error(res, error.message, 404);
    }
    return respond.error(res, 'Failed to assign SLA: ' + error.message);
  }
});

/**
 * @openapi
 * /api/apikeys/{id}/slas/{slaId}:
 *   delete:
 *     summary: Remove an SLA from an API Key
 *     tags:
 *       - API Keys
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 apiKey:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     slas:
 *                       type: array
 *                       items:
 *                         type: string
 *             examples:
 *               removed:
 *                 summary: Example response after SLA removal
 *                 value:
 *                   success: true
 *                   message: "SLA removed from API Key successfully"
 *                   apiKey:
 *                     id: "1f2e3d4c..."
 *                     slas: ["sla-basic"]
 *       '404':
 *         description: API Key not found
 *       '500':
 *         description: Server error
 */
router.delete('/:id/slas/:slaId', async (req, res) => {
  try {
    const updated = await apiKeyStore.removeSLAFromAPIKey(req.params.id, req.params.slaId);
    
    return respond.success(res, {
      message: 'SLA removed from API Key successfully',
      apiKey: updated
    });
  } catch (error) {
    console.error('Error removing SLA from API Key:', error);
    if (error.message === 'API Key not found') {
      return respond.error(res, error.message, 404);
    }
    return respond.error(res, 'Failed to remove SLA: ' + error.message);
  }
});

/**
 * @openapi
 * /api/apikeys/{id}:
 *   delete:
 *     summary: Delete an API Key
 *     tags:
 *       - API Keys
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: API Key deleted successfully
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
 *                   message: "API Key deleted successfully"
 *       '404':
 *         description: API Key not found
 *       '500':
 *         description: Server error
 */
router.delete('/:id', async (req, res) => {
  try {
    const numRemoved = await apiKeyStore.removeAPIKey(req.params.id);
    
    if (numRemoved === 0) {
      return respond.error(res, 'API Key not found', 404);
    }
    
    return respond.success(res, {
      message: 'API Key deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting API Key:', error);
    return respond.error(res, 'Failed to delete API Key: ' + error.message);
  }
});

module.exports = router;
