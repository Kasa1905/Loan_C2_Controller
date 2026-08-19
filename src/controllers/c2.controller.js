const c2Service = require('../services/c2.service');

async function processApplication(req, res, next) {
  try {
    const trigger = typeof req.body?.trigger === 'string' && req.body.trigger.trim()
      ? req.body.trigger
      : 'INITIAL_ASSESSMENT';
    const result = await c2Service.processApplication(req.params.applicationId, trigger);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = { processApplication };
