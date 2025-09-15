import { Pool, PoolClient } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function withTenant<T>(
  host: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    // 1) find tenant for this host
    const { rows } = await client.query<{ id: string }>(
      `select t.id
         from tenants t
         join domains d on d.tenant_id = t.id
        where lower(d.hostname) = lower($1)
        limit 1`,
      [host]
    );

    if (!rows.length) {
      throw new Error(`Unknown tenant for host "${host}"`);
    }

    const tenantId = rows[0].id;

    // 2) set session variables for the entire session (is_local = false)
    await client.query(
      `select
         set_config('app.tenant_id', $1, false),
         set_config('app.role', 'user', false)`,
      [tenantId]
    );

    // 3) run user code in this session
    const result = await fn(client);

    return result;
  } finally {
    client.release();
  }
}
