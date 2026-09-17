'use strict';
const { checkEnterpriseEnrollment } = require('./enterpriseEnrollmentClient');
const { getColaberryUserByEmail } = require('./colaberrySqlClient');

// Login-gate check only — answers "is this email allowed to log in," not
// "does this email have Colaberry project data to import." That's a
// separate, narrower question colaberryImport.js still answers directly via
// getColaberryUserByEmail: it needs a real school-DB UserID to pull project
// links from (ADF_CAP_Launch_Participants), which the enterprise platform's
// enrollment lookup doesn't provide. A student who only exists on the
// enterprise platform can log in via this gate but will correctly get "no
// Colaberry account found" when trying to auto-import projects — there's
// nothing in the school DB to import for them.
//
// Gate order (first match wins), per Ali 2026-09-16: the enterprise
// platform is authoritative for Accelerator launch-cohort students (many
// absent from the school SQL Server entirely); the school's active-users
// table covers everyone else currently active; the MP_History fallback
// (PROGRESS.md M109) covers alumni/placed/lapsed students with mentorship
// history, now excluding non-genuine statuses (see colaberrySqlClient.js).
async function isColaberryLoginAllowed(email) {
  if (await checkEnterpriseEnrollment(email)) return true;
  return Boolean(await getColaberryUserByEmail(email));
}

module.exports = { isColaberryLoginAllowed };
