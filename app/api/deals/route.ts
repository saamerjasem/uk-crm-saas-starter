import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/server/db'
import { getHost } from '@/src/server/host'

export async function GET(req: NextRequest) {
  const host = getHost(req as unknown as Request)
  const data = await withTenant(host, async (client) => {
    const { rows } = await client.query(`
      select d.id, d.title, d.value, d.currency, s.name as stage, d.status
      from deals d
      left join stages s on s.id = d.stage_id
      order by d.created_at desc
      limit 200
    `)
    return rows
  })
  return NextResponse.json({ deals: data })
}

export async function POST(req: NextRequest) {
  const host = getHost(req as unknown as Request)
  const body = await req.json()
  const { title, value, currency } = body
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  const data = await withTenant(host, async (client) => {
    // ensure default pipeline and stage exist
    await client.query(`select ensure_default_pipeline_and_stage()`)
    const { rows } = await client.query(
      `insert into deals(title, value, currency, pipeline_id, stage_id, status)
       values ($1, $2, coalesce($3,'GBP'), (select id from pipelines limit 1), (select id from stages order by order_index limit 1), 'open')
       returning id`,
      [title, value || 0, currency || 'GBP']
    )
    return rows[0]
  })
  return NextResponse.json({ ok: true, id: data.id })
}
