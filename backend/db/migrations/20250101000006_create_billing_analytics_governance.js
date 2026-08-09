exports.up = pgm => {
  pgm.sql(`
    CREATE TABLE subscriptions (
      id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id               UUID        REFERENCES tenants(id) ON DELETE SET NULL,
      user_id                 UUID        REFERENCES users(id) ON DELETE SET NULL,
      provider                TEXT,
      external_subscription_id TEXT,
      plan                    TEXT,
      status                  TEXT        NOT NULL DEFAULT 'active',
      renewal_at              TIMESTAMPTZ,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE events (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id     UUID,
      user_id       UUID,
      anonymous_id  TEXT,
      event_type    TEXT        NOT NULL,
      entity_type   TEXT,
      entity_id     UUID,
      metadata_json JSONB,
      occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_events_type ON events(event_type, occurred_at);

    CREATE TABLE audit_logs (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_user_id UUID,
      tenant_id     UUID,
      action        TEXT        NOT NULL,
      target_type   TEXT,
      target_id     UUID,
      metadata_json JSONB,
      ip_address    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id, created_at DESC);
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DROP TABLE IF EXISTS audit_logs   CASCADE;
    DROP TABLE IF EXISTS events       CASCADE;
    DROP TABLE IF EXISTS subscriptions CASCADE;
  `);
};
