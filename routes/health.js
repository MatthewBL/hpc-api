const express = require('express');
const respond = require('../utils/response');
const router = express.Router();

router.get('/', (req, res) => {
  return respond.success(res, {
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'HPC API'
  });
});

module.exports = router;