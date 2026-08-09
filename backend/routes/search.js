const express = require('express');
const pool = require('../db/postgres');

const router = express.Router();

// GET /api/search/portfolios
// Public — no auth. Recruiter-facing search across published portfolios.
// Query params: q (keyword), skill, language, page, limit
router.get('/portfolios', async (req, res) => {
  const q        = (req.query.q || '').trim().toLowerCase();
  const skill    = (req.query.skill || '').trim().toLowerCase();
  const language = (req.query.language || '').trim();
  const page     = Math.max(1, parseInt(req.query.page) || 1);
  const limit    = Math.min(parseInt(req.query.limit) || 12, 50);
  const offset   = (page - 1) * limit;

  try {
    // Build WHERE conditions
    const conditions = [`p.status = 'published'`, `p.visibility = 'public'`];
    const params = [];
    let i = 1;

    if (q) {
      conditions.push(`(
        lower(p.title) LIKE $${i}
        OR lower(p.content_json->>'narrative') LIKE $${i}
        OR lower(p.content_json->>'headline') LIKE $${i}
      )`);
      params.push(`%${q}%`);
      i++;
    }

    if (language) {
      conditions.push(`EXISTS (
        SELECT 1 FROM repositories r2
        WHERE r2.id = ANY(
          ARRAY(SELECT jsonb_array_elements_text(p.content_json->'repository_ids')::uuid)
        )
        AND lower(r2.primary_language) = lower($${i})
      )`);
      params.push(language);
      i++;
    }

    if (skill) {
      conditions.push(`EXISTS (
        SELECT 1 FROM analyses a2
        JOIN repositories r3 ON r3.id = a2.repository_id
        WHERE r3.id = ANY(
          ARRAY(SELECT jsonb_array_elements_text(p.content_json->'repository_ids')::uuid)
        )
        AND a2.status = 'completed'
        AND lower(a2.skills_json::text) LIKE $${i}
      )`);
      params.push(`%${skill}%`);
      i++;
    }

    const where = conditions.join(' AND ');

    const [portfoliosResult, countResult] = await Promise.all([
      pool.query(
        `SELECT
           p.id, p.title, p.slug, p.published_at,
           p.content_json->'narrative' AS narrative,
           u.name AS author_name, u.github_username
         FROM portfolios p
         JOIN users u ON u.id = p.user_id
         WHERE ${where}
         ORDER BY p.published_at DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM portfolios p WHERE ${where}`,
        params
      ),
    ]);

    // For each portfolio, pull top skills and languages from their repo analyses
    const portfolioIds = portfoliosResult.rows.map(p => p.id);
    let skillsMap = {};

    if (portfolioIds.length > 0) {
      const skillsResult = await pool.query(
        `SELECT
           p2.id AS portfolio_id,
           r.primary_language,
           a.skills_json
         FROM portfolios p2
         CROSS JOIN LATERAL jsonb_array_elements_text(p2.content_json->'repository_ids') AS rid_text
         JOIN repositories r ON r.id = rid_text::uuid
         LEFT JOIN LATERAL (
           SELECT skills_json FROM analyses
           WHERE repository_id = r.id AND status = 'completed'
           ORDER BY created_at DESC LIMIT 1
         ) a ON true
         WHERE p2.id = ANY($1::uuid[])`,
        [portfolioIds]
      );

      skillsResult.rows.forEach(row => {
        if (!skillsMap[row.portfolio_id]) skillsMap[row.portfolio_id] = { skills: new Set(), languages: new Set() };
        if (row.primary_language) skillsMap[row.portfolio_id].languages.add(row.primary_language);
        if (row.skills_json) {
          try {
            const techs = Array.isArray(row.skills_json) ? row.skills_json : JSON.parse(row.skills_json);
            techs.slice(0, 5).forEach(t => skillsMap[row.portfolio_id].skills.add(t.name));
          } catch {}
        }
      });
    }

    const portfolios = portfoliosResult.rows.map(p => {
      const info = skillsMap[p.id] || { skills: new Set(), languages: new Set() };
      const narrative = p.narrative || {};
      return {
        portfolioId:  p.id,
        title:        p.title,
        slug:         p.slug,
        publishedAt:  p.published_at,
        authorName:   p.author_name || null,
        githubUsername: p.github_username || null,
        headline:     narrative.headline || null,
        topSkills:    narrative.top_skills?.slice(0, 6) || [...info.skills].slice(0, 6).map(s => ({ name: s })),
        languages:    [...info.languages].filter(Boolean),
        publicUrl:    `/portfolio/${p.slug}`,
      };
    });

    return res.status(200).json({
      success: true,
      data: portfolios,
      meta: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (err) {
    console.error('[search] portfolios error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Search failed.' } });
  }
});

// GET /api/search/filters — return available languages for filter dropdowns
router.get('/filters', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT r.primary_language
       FROM repositories r
       JOIN portfolios p ON r.id = ANY(
         ARRAY(SELECT jsonb_array_elements_text(p.content_json->'repository_ids')::uuid)
       )
       WHERE p.status = 'published'
         AND p.visibility = 'public'
         AND r.primary_language IS NOT NULL
       ORDER BY r.primary_language`
    );

    const languages = result.rows.map(r => r.primary_language);
    return res.status(200).json({ success: true, data: { languages } });
  } catch (err) {
    console.error('[search] filters error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to load filters.' } });
  }
});

module.exports = router;
