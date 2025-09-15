import { Pool, PoolClient } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Looks up the tenant by hostname, sets app.tenant_id and app.role
 * for the session, then runs your callback in that context.
 */
export async function withTenant<T>(host: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    // 1) find tenant_id for this host
    const { rows } = await client.query<{
      id: string;
    }>(
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

    // 2) set session variables used by RLS and inserts
    await client.query(`select
        set_config('app.tenant_id', $1, true),
        set_config('app.role', 'user', true)`, [tenantId]);

    // 3) run the work in this session
    return await fn(client);
  } finally {
    client.release();
  }
}
