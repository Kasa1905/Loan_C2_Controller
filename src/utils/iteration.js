const { randomUUID } = require('node:crypto');

function nextIteration(application, trigger) {
  const history = Array.isArray(application?.riskAssessment?.history)
    ? application.riskAssessment.history
    : [];
  const highestNumber = history.reduce(
    (highest, entry) => Math.max(highest, Number(entry?.number) || 0),
    0,
  );

  return {
    iterationId: randomUUID(),
    number: highestNumber + 1,
    trigger: trigger || 'INITIAL_ASSESSMENT',
    timestamp: new Date().toISOString(),
  };
}

module.exports = { nextIteration };
