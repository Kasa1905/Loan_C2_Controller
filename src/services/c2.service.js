const mongoose = require('mongoose');
const config = require('../config/env');
const { getCollection } = require('../database/mongo');
const { AppError } = require('../utils/errors');
const { nextIteration } = require('../utils/iteration');
const { toNormalizedScale } = require('../utils/score');
const ruleEngine = require('./ruleEngine.service');
const riskEngine = require('./riskEngine.service');

function previousAssessment(application) {
  const current = application?.riskAssessment?.current;
  if (!current || typeof current !== 'object') {
    return { available: false, iteration: null, score: null, riskLevel: null };
  }
  return {
    available: true,
    iteration: current.number ?? null,
    score: current.score ?? null,
    riskLevel: current.riskLevel ?? null,
  };
}

function buildRuleEnginePayload(applicationId, application) {
  const monthlyIncome = application?.applicantDetails?.monthlyIncome ?? null;
  const annualIncome = monthlyIncome ? monthlyIncome * 12 : null;
  const cibilScore = application?.financialDetails?.cibilScore ?? null;

  return {
    schemaVersion: '1.0',
    application_id: applicationId,
    application: {
      loanApplication: {
        bank_name: null,
        loan_type: application?.loanDetails?.loanType ?? null,
        loan_amount: application?.loanDetails?.loanAmount ?? null,
        loan_tenure_months: application?.loanDetails?.tenureMonths ?? null,
      },
      candidate: {
        date_of_birth: application?.applicantDetails?.dateOfBirth ?? null,
        age: null,
        monthly_income: monthlyIncome,
        annual_income: annualIncome,
        occupation: application?.applicantDetails?.occupation ?? null,
        employer: application?.applicantDetails?.employer ?? null,
        designation: application?.applicantDetails?.designation ?? null,
        employment_type: null,
        joining_date: null,
        credit_score: null,
        cibil_score: cibilScore,
        existing_emi_burden: application?.financialDetails?.emiObligations ?? null,
        existing_loans: application?.financialDetails?.existingLoans ?? null,
        emi_obligations: application?.financialDetails?.emiObligations ?? null,
        number_of_dependents: application?.financialDetails?.numberOfDependents ?? null,
        credit_history: application?.financialDetails?.creditHistoryYears ?? null,
        debt_to_income_ratio: null,
      },
      documents: Array.isArray(application?.documents) ? application.documents : [],
    },
  };
}

function buildRiskInput(
  applicationId,
  application,
  ruleEnginePayload,
  ruleResult,
  previous,
  iteration
) {
  const documents = Array.isArray(application.documents)
    ? application.documents
    : [];

  const applicant = application.applicantDetails || {};
  const financial = application.financialDetails || {};
  const loan = application.loanDetails || {};

  return {
    schemaVersion: '1.0',
    source: 'C2',

    application: {
      applicationId,

      applicantDetails: {
        ...applicant,

        // Map actual application fields -> Risk Detection fields
        creditScore: financial.cibilScore ?? null,
        creditHistoryYears: financial.creditHistoryYears ?? null,
        previousDefaults: financial.previousLoanDefaults ?? null,

        // Existing data already lives here
        monthlyIncome: applicant.monthlyIncome ?? null,

        // Optional fields if available
        employmentType: applicant.employmentType ?? null,
        employmentTenureMonths: applicant.employmentTenureMonths ?? null,
      },

      financialDetails: {
        ...financial,

        // Map actual application fields -> Risk Detection fields
        monthlyIncome: applicant.monthlyIncome ?? null,
        existingEmiAmount: financial.emiObligations ?? null,

        monthlyExpenses: financial.monthlyExpenses ?? null,
        otherLiabilities: financial.otherLiabilities ?? null,
        bankBalance: financial.bankBalance ?? null,
      },

      loanDetails: {
        ...loan,

        loanAmount: loan.loanAmount ?? null,
        tenureMonths: loan.tenureMonths ?? null,
      },

      documents,

      processingStatus: application.processingStatus ?? null,
      profileStatus: application.profileStatus ?? null,
      eligibilityStatus: application.eligibilityStatus ?? null,
      eligibilityScore: application.eligibilityScore ?? null,
    },

    applicantDetails: {
      ...applicant,

      creditScore: financial.cibilScore ?? null,
      creditHistoryYears: financial.creditHistoryYears ?? null,
      previousDefaults: financial.previousLoanDefaults ?? null,

      monthlyIncome: applicant.monthlyIncome ?? null,

      employmentType: applicant.employmentType ?? null,
      employmentTenureMonths: applicant.employmentTenureMonths ?? null,
    },

    financialDetails: {
      ...financial,

      monthlyIncome: applicant.monthlyIncome ?? null,
      existingEmiAmount: financial.emiObligations ?? null,
    },

    loanDetails: {
      ...loan,

      loanAmount: loan.loanAmount ?? null,
      tenureMonths: loan.tenureMonths ?? null,
    },

    documents,

    documentProcessing: {
      status: application.processingStatus ?? null,
      profileStatus: application.profileStatus ?? null,
      verificationStatus: application.verificationStatus ?? null,
      verificationScore: application.verificationScore ?? null,
      digitalProfile: application.digitalProfile ?? null,
      documents,
    },

    ruleEngine: {
      // IMPORTANT: Risk Detection expects PASSED/PARTIAL/FAILED,
      // not the C2 wrapper status COMPLETED.
      status:
        ruleResult?.result?.status ??
        ruleResult?.result?.ruleStatus ??
        ruleResult?.status ??
        null,

      compliant:
        ruleResult?.result?.compliant ??
        ruleResult?.result?.isCompliant ??
        null,

      violations:
        ruleResult?.result?.violations ??
        [],

      ruleScore:
        ruleResult?.result?.ruleScore ??
        ruleResult?.result?.complianceScore ??
        null,
    },

    ruleEnginePayload,

    previousRiskAssessment: previous,

    // CRITICAL: Risk Detection expects an integer
    iteration: iteration.number,
  };
}

function currentAssessment(iteration, riskResult) {
  const completed = riskResult.status === 'COMPLETED' && riskResult.result && typeof riskResult.result === 'object';
  const result = completed ? riskResult.result : null;
  const rawScore = completed && typeof result.score === 'number' ? result.score : null;
  const normalizedScore = toNormalizedScale(rawScore);
  
  return {
    ...iteration,
    status: completed ? 'COMPLETED' : 'FAILED',
    score: normalizedScore,
    riskLevel: completed ? result.riskLevel ?? null : null,
    result,
    ...(riskResult.error ? { error: riskResult.error } : {}),
  };
}

async function persistAssessment(applicationId, assessment) {
  const collection = getCollection();
  const filter = { _id: new mongoose.Types.ObjectId(applicationId) };
  const update = {
    $push: { 'riskAssessment.history': assessment },
    $set: { updatedAt: new Date() },
  };

  if (assessment.status === 'COMPLETED') {
    update.$set['riskAssessment.current'] = assessment;
    const result = assessment.result;
    for (const field of ['riskLevel', 'riskFlags', 'eligibilityStatus', 'eligibilityScore', 'eligibilityReason']) {
      if (Object.prototype.hasOwnProperty.call(result, field)) {
        update.$set[field] = result[field];
      }
    }
  }

  const writeResult = await collection.updateOne(filter, update);
  if (writeResult.matchedCount !== 1) {
    throw new AppError(404, `Application ${applicationId} was not found`);
  }
}

function toJsonSafe(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  if (obj._id && typeof obj._id === 'object' && obj._id.toString) {
    return String(obj._id);
  }
  if (typeof obj.toString === 'function' && obj.constructor && obj.constructor.name === 'ObjectId') {
    return String(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(toJsonSafe);
  }
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('_')) {
      if (key === '_id') {
        result[key] = String(value);
      }
      continue;
    }
    result[key] = toJsonSafe(value);
  }
  return result;
}

async function processApplication(applicationId, trigger) {
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    throw new AppError(400, 'applicationId must be a valid MongoDB ObjectId');
  }

  const application = await getCollection().findOne({ _id: new mongoose.Types.ObjectId(applicationId) });
  if (!application) {
    throw new AppError(404, `Application ${applicationId} was not found`);
  }

  const previous = previousAssessment(application);
  const iteration = nextIteration(application, trigger);
  const ruleEnginePayload = buildRuleEnginePayload(applicationId, application);
  const ruleResult = await ruleEngine.evaluate(ruleEnginePayload);
  const riskInput = buildRiskInput(applicationId, application, ruleEnginePayload, ruleResult, previous, iteration);
  const riskResult = await riskEngine.evaluate(riskInput);
  const assessment = currentAssessment(iteration, riskResult);

  await persistAssessment(applicationId, assessment);
  
  return toJsonSafe({
    applicationId,
    iteration,
    ruleEngine: ruleResult,
    ruleEnginePayload,
    riskInput,
    riskDetection: riskResult,
    riskAssessment: assessment,
  });
}

module.exports = { processApplication, buildRiskInput };
