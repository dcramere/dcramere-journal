// Migraties draaien tijdens de build (scripts/migrate.mjs) en in dev/tests.
// Voeg nieuwe migraties onderaan toe; pas bestaande nooit aan.
export const MIGRATIONS = [
  {
    id: "001_init",
    statements: [
      `CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        name text NOT NULL,
        password_hash text NOT NULL,
        role text NOT NULL DEFAULT 'client' CHECK (role IN ('client','admin')),
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
        consent_at bigint,
        created_at bigint NOT NULL,
        last_login_at bigint
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash text NOT NULL UNIQUE,
        user_agent text,
        created_at bigint NOT NULL,
        expires_at bigint NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id)`,
      `CREATE TABLE IF NOT EXISTS accounts (
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        id text NOT NULL,
        name text NOT NULL,
        broker text NOT NULL DEFAULT '',
        type text NOT NULL,
        start_balance double precision NOT NULL DEFAULT 0,
        risk_mode text NOT NULL,
        risk_unit text NOT NULL,
        risk_value double precision NOT NULL DEFAULT 0,
        commission double precision NOT NULL DEFAULT 0,
        adjustments jsonb NOT NULL DEFAULT '[]',
        created_at bigint NOT NULL,
        PRIMARY KEY (user_id, id)
      )`,
      `CREATE TABLE IF NOT EXISTS trades (
        user_id uuid NOT NULL,
        id text NOT NULL,
        account_id text NOT NULL,
        symbol text NOT NULL,
        direction text NOT NULL,
        qty double precision NOT NULL,
        entry_price double precision,
        exit_price double precision,
        opened_at bigint NOT NULL,
        closed_at bigint NOT NULL,
        pnl double precision NOT NULL,
        fees double precision NOT NULL DEFAULT 0,
        r double precision,
        setup text NOT NULL DEFAULT '',
        mood text NOT NULL DEFAULT '',
        lesson text NOT NULL DEFAULT '',
        has_screenshot boolean NOT NULL DEFAULT false,
        source text NOT NULL DEFAULT 'manual',
        fills integer,
        position_size text NOT NULL DEFAULT '',
        created_at bigint NOT NULL,
        updated_at bigint NOT NULL,
        PRIMARY KEY (user_id, id),
        FOREIGN KEY (user_id, account_id) REFERENCES accounts(user_id, id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS trades_user_closed_idx ON trades(user_id, closed_at)`,
      `CREATE TABLE IF NOT EXISTS screenshots (
        user_id uuid NOT NULL,
        trade_id text NOT NULL,
        data text NOT NULL,
        PRIMARY KEY (user_id, trade_id),
        FOREIGN KEY (user_id, trade_id) REFERENCES trades(user_id, id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS user_settings (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        settings jsonb NOT NULL DEFAULT '{}',
        updated_at bigint NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS audit_log (
        id bigserial PRIMARY KEY,
        actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
        target_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action text NOT NULL,
        created_at bigint NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS audit_target_idx ON audit_log(target_user_id, created_at DESC)`,
      `CREATE TABLE IF NOT EXISTS rate_limits (
        key text PRIMARY KEY,
        window_start bigint NOT NULL,
        count integer NOT NULL
      )`,
    ],
  },
  {
    id: "002_password_resets",
    statements: [
      `CREATE TABLE IF NOT EXISTS password_resets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash text NOT NULL UNIQUE,
        created_at bigint NOT NULL,
        expires_at bigint NOT NULL,
        used_at bigint
      )`,
      `CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets(user_id)`,
    ],
  },
];

// `run(text, params)` voert één statement uit en geeft rijen terug.
export async function migrate(run, log = () => {}) {
  await run(`CREATE TABLE IF NOT EXISTS _migrations (id text PRIMARY KEY, applied_at bigint NOT NULL)`, []);
  const done = new Set((await run(`SELECT id FROM _migrations`, [])).map((r) => r.id));
  let applied = 0;
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    for (const sql of m.statements) await run(sql, []);
    await run(`INSERT INTO _migrations (id, applied_at) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [m.id, Date.now()]);
    log(`applied ${m.id}`);
    applied += 1;
  }
  return applied;
}
