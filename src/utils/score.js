function normalizedScore(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return null;
  }
  if (score < 0 || score > 100) {
    return null;
  }
  return score;
}

function toNormalizedScale(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return null;
  }
  if (score <= 10 && score >= 0) {
    return score * 10;
  }
  if (score >= 0 && score <= 100) {
    return score;
  }
  return null;
}

module.exports = { normalizedScore, toNormalizedScale };
