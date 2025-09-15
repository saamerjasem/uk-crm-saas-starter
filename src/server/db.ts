import { Pool, PoolClient } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

const LOG_SQL = process.env.LOG_SQL === 'true'

export async function withTenant<T>(hostname: string, fn: (client: PoolClient, tenantId: string) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    // resolve tenant by hostname
    const { rows } = await client.query(
      `select t.id as tenant_id from domains d join tenants t on t.id = d.tenant_id where d.hostname = $1 and t.status = 'active' limit 1`,
      [hostname]
    )
    if (rows.length === 0) {
      throw new Error('Unknown tenant for host ' + hostname)
    }
    const tenantId = rows[0].tenant_id
    // set tenant and default role
    await client.query(`select set_config('app.tenant_id', $1, true)`, [tenantId])
    await client.query(`select set_config('app.role', 'user', true)`)
    if (LOG_SQL) console.log('[tenant]', tenantId, hostname)
    const result = await fn(client, tenantId)
    return result
  } finally {
    client.release()
  }
}

export async function withAdmin<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query(`select set_config('app.role', 'admin', true)`)
    const result = await fn(client)
    return result
  } finally {
    client.release()
  }
}
