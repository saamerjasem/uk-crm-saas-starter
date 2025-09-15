import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/server/db'
import { getHost } from '@/src/server/host'

export async function GET(req: NextRequest) {
  const host = getHost(req as unknown as Request)
  const data = await withTenant(host, async (client) => {
    const { rows } = await client.query(`
      select id, first_name, last_name, email, phone
      from contacts
      order by created_at desc
      limit 200
    `)
    return rows
  })
  return NextResponse.json({ contacts: data })
}

export async function POST(req: NextRequest) {
  const host = getHost(req as unknown as Request)
  const body = await req.json()
  const { first_name, last_name, email, phone } = body
  if (!first_name || !last_name) {
    return NextResponse.json({ error: 'first_name and last_name required' }, { status: 400 })
  }
  const data = await withTenant(host, async (client) => {
    const { rows } = await client.query(
      `insert into contacts(first_name, last_name, email, phone) values ($1,$2,$3,$4) returning id`,
      [first_name, last_name, email || null, phone || null]
    )
    return rows[0]
  })
  return NextResponse.json({ ok: true, id: data.id })
}
