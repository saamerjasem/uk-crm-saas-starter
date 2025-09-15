import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { withAdmin } from '@/src/server/db'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')
  const whsec = process.env.STRIPE_WEBHOOK_SECRET as string
  if (!sig || !whsec) return NextResponse.json({ error: 'Missing Stripe headers' }, { status: 400 })
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2023-10-16' })
  const buf = Buffer.from(await req.arrayBuffer())
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(buf, sig, whsec)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature verification failed, ${err.message}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const email = (session.customer_details && session.customer_details.email) || 'unknown@example.com'
    const name = session.client_reference_id || (session.customer_details && session.customer_details.name) || 'New Tenant'
    await withAdmin(async (client) => {
      // create tenant if not exists
      const { rows } = await client.query(`
        insert into tenants(name, plan, status)
        values ($1, 'pro', 'active')
        on conflict (name) do update set updated_at = now()
        returning id
      `, [name])
      const tenantId = rows[0].id
      // create a default domain placeholder, you can later update the hostname when the user picks it
      await client.query(`
        insert into domains(tenant_id, hostname, primary_domain)
        values ($1, concat(replace(lower($2), ' ', ''), '.local'), true)
        on conflict do nothing
      `, [tenantId, name])
      // store subscription link, minimal example
      await client.query(`
        insert into subscriptions(tenant_id, stripe_customer_id, stripe_sub_id, plan, status)
        values ($1, $2, coalesce($3, 'sub_pending'), 'pro', 'active')
        on conflict do nothing
      `, [tenantId, session.customer as string, session.subscription as string | null])
    })
  }

  return NextResponse.json({ received: true })
}
