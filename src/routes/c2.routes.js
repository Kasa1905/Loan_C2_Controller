const express = require('express');
const { processApplication } = require('../controllers/c2.controller');

const router = express.Router();
router.post('/process/:applicationId', processApplication);

module.exports = router;
