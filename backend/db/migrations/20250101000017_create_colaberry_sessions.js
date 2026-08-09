exports.up = pgm => {
  pgm.sql(`
    CREATE TABLE colaberry_sessions (
      id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                 UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      encrypted_storage_state TEXT        NOT NULL,
      encryption_iv           TEXT        NOT NULL,
      captured_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    COMMENT ON TABLE colaberry_sessions IS
      'One live-login-captured Colaberry browser session per user, AES-256-GCM encrypted at rest. Captured via the embedded live-browser flow, reused headlessly for scraping until it expires (Colaberry rejects it), at which point the user re-runs the live-login flow.';
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DROP TABLE IF EXISTS colaberry_sessions CASCADE;
  `);
};
