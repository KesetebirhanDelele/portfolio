exports.up = pgm => {
  pgm.sql(`
    CREATE TABLE recruiter_accounts (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      company_name TEXT,
      approved_at  TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE shortlists (
      id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      recruiter_user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      candidate_user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      notes                TEXT,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (recruiter_user_id, candidate_user_id)
    );
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DROP TABLE IF EXISTS shortlists        CASCADE;
    DROP TABLE IF EXISTS recruiter_accounts CASCADE;
  `);
};
