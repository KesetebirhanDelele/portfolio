'use strict';
const axios = require('axios');

const ENTERPRISE_ENROLLMENT_URL = 'https://enterprise.colaberry.ai/api/v1/enrollments/lookup';

// Checks whether an email is an active, paying Accelerator enrollment on
// Colaberry's enterprise platform — the authoritative source for launch
// cohorts, which may not exist in the school SQL Server at all (Ali,
// 2026-09-16: 73 active AI Systems Architect Accelerator students, only 34
// present in ADF_ColaberryActiveUsers, ~39 in neither school table). Shares
// the training site's service token (TRAINING_TOKEN).
//
// Fails OPEN (returns false, never throws) on any error — a bad token, a
// timeout, an unexpected response shape. This is the first of three OR'd
// login-gate layers (see colaberryAccessGate.js); an outage or
// misconfiguration here must not block logins for students the SQL
// fallback already covers. Errors are still logged loudly, since a silently
// broken token would otherwise look identical to "no active enrollment" for
// the students who depend on this layer specifically (the ones absent from
// both school tables).
async function checkEnterpriseEnrollment(email) {
  const token = process.env.TRAINING_TOKEN;
  if (!token) {
    console.error('[enterpriseEnrollmentClient] TRAINING_TOKEN not set — enrollment lookup skipped, falling through to school DB');
    return false;
  }

  try {
    const response = await axios.get(ENTERPRISE_ENROLLMENT_URL, {
      params: { email },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    });
    return response.data?.enrolled === true;
  } catch (err) {
    const status = err.response?.status;
    const errorClass = status === 401 ? 'AuthError'
      : status === 400 ? 'ValidationError'
      : err.code === 'ECONNABORTED' ? 'TimeoutError'
      : 'UpstreamUnavailable';
    console.error(
      `[enterpriseEnrollmentClient] lookup failed (${errorClass}${status ? `, HTTP ${status}` : ''}):`,
      err.message
    );
    return false;
  }
}

module.exports = { checkEnterpriseEnrollment };
