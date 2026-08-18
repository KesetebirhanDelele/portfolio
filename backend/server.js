require('dotenv').config();
const { initErrorTracking, setupExpressErrorHandler } = require('./services/errorTracking');
initErrorTracking(); // as early as possible, per Sentry's own setup guidance — no-op if SENTRY_DSN unset
require('./db/postgres');
const express = require('express');
const cors = require('cors');
const authRouter            = require('./routes/auth');
const usersRouter           = require('./routes/users');
const reposRouter           = require('./routes/repos');
const githubAccountsRouter  = require('./routes/githubAccounts');
const githubAppRouter       = require('./routes/githubApp');
const analysisRouter        = require('./routes/analysis');
const deepAnalysisRouter    = require('./routes/deepAnalysis');
const portfoliosRouter      = require('./routes/portfolios');
const searchRouter          = require('./routes/search');
const colaberryLiveLoginRouter = require('./routes/colaberryLiveLogin');
const colaberryImportRouter = require('./routes/colaberryImport');
const heavyTasksRouter      = require('./routes/heavyTasks');
const adminRouter           = require('./routes/admin');
const healthRouter          = require('./routes/health');
const requestTiming         = require('./middleware/requestTiming');
const healthMonitor         = require('./services/healthMonitor');
const { attachWsProxy }     = require('./services/colaberryLiveLoginWsProxy');
const { cleanupOrphanedContainers } = require('./services/colaberryLiveLoginSessionManager');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(requestTiming);
app.use(cors());
app.use(express.json());

app.use('/api/auth',            authRouter);
app.use('/api/users',           usersRouter);
app.use('/api/repos',           reposRouter);
app.use('/api/github-accounts', githubAccountsRouter);
app.use('/api/github-app',      githubAppRouter);
app.use('/api/analysis',       analysisRouter);
app.use('/api/deep-analysis',  deepAnalysisRouter);
app.use('/api/portfolios', portfoliosRouter);
app.use('/api/search',     searchRouter);
app.use('/api/colaberry-login', colaberryLiveLoginRouter);
app.use('/api/colaberry-import', colaberryImportRouter);
app.use('/api/heavy-tasks',      heavyTasksRouter);
app.use('/api/admin',            adminRouter);
app.use('/api/health',           healthRouter);

app.get('/', (req, res) => {
  res.send('Backend is running');
});

// Must come after all routes, before any other error middleware — forwards
// unhandled request errors to Sentry. No-op if SENTRY_DSN isn't set.
setupExpressErrorHandler(app);

const server = app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  attachWsProxy(server);
  healthMonitor.start();
  cleanupOrphanedContainers().catch(err =>
    console.error('[startup] orphaned live-login container cleanup failed:', err.message)
  );

  // Resume any analyses that were queued/running when the server last stopped
  try {
    const pool = require('./db/postgres');
    // deepAnalysisQueue.js registers the 'deep-analysis-pipeline' heavy-task
    // handler as a side effect of being required — importing it here (even
    // though only enqueueHeavyTask is used directly) ensures that handler
    // exists before any orphaned job is enqueued below.
    require('./services/deepAnalysisQueue');
    const { enqueueHeavyTask } = require('./services/heavyTaskQueue');

    const orphaned = await pool.query(
      `SELECT da.id AS analysis_id, da.repository_id,
              r.id, r.name, r.full_name, r.description, r.primary_language,
              r.default_branch, r.topics, r.stars_count, r.forks_count, r.readme_content,
              r.user_id
       FROM deep_analyses da
       JOIN repositories r ON r.id = da.repository_id
       WHERE da.status IN ('queued', 'running')
       ORDER BY da.created_at ASC`
    );

    if (orphaned.rows.length > 0) {
      console.log(`[startup] Resuming ${orphaned.rows.length} orphaned analysis job(s)…`);
      // Reset any 'running' rows back to 'queued' so the pipeline can restart them cleanly
      await pool.query(
        `UPDATE deep_analyses SET status = 'queued' WHERE status = 'running'`
      );
      for (const row of orphaned.rows) {
        const repoData = {
          id: row.id, name: row.name, full_name: row.full_name,
          description: row.description, primary_language: row.primary_language,
          default_branch: row.default_branch, topics: row.topics,
          stars_count: row.stars_count, forks_count: row.forks_count,
          readme_content: row.readme_content,
        };
        const [owner] = row.full_name.split('/');
        // Same heavy-task queue as a normal deep-analysis trigger (Tier 2) —
        // previously this fired every orphaned analysis via setImmediate
        // simultaneously, so a restart with several queued/running rows
        // would launch that many pipelines (each several OpenAI calls) at
        // once with no cap at all.
        await enqueueHeavyTask('deep-analysis-pipeline', { analysisId: row.analysis_id, repoData, userId: row.user_id, owner });
      }
    }
  } catch (err) {
    console.error('[startup] Failed to resume orphaned analyses:', err.message);
  }
});
