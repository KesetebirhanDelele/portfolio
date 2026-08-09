require('dotenv').config();
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

const app = express();
const PORT = 5000;

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

app.get('/', (req, res) => {
  res.send('Backend is running');
});

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Resume any analyses that were queued/running when the server last stopped
  try {
    const pool = require('./db/postgres');
    const { runDeepAnalysisPipeline } = require('./services/deepAnalysisPipeline');
    const { PHASE_IMPLS } = require('./services/deepAnalysisQueue');

    const orphaned = await pool.query(
      `SELECT da.id AS analysis_id, da.repository_id,
              r.id, r.name, r.full_name, r.description, r.primary_language,
              r.default_branch, r.topics, r.stars_count, r.forks_count, r.readme_content
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
        setImmediate(() =>
          runDeepAnalysisPipeline(row.analysis_id, repoData, PHASE_IMPLS).catch(err =>
            console.error(`[startup] pipeline error for ${row.analysis_id}:`, err.message)
          )
        );
      }
    }
  } catch (err) {
    console.error('[startup] Failed to resume orphaned analyses:', err.message);
  }
});
