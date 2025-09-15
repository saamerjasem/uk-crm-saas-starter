import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/src/server/db";
import { getHost } from "@/src/server/host";

/** GET /api/contacts */
export async function GET(req: NextRequest) {
  try {
    const host = getHost(req as unknown as Request);

    const rows = await withTenant(host, async (client) => {
      const { rows } = await client.query(
        `select id, first_name, last_name, email, phone
           from contacts
          where tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
          order by created_at desc nulls last, last_name asc, first_name asc`
      );
      return rows;
    });

    return NextResponse.json({ contacts: rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "fetch_failed", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}

/** POST /api/contacts */
export async function POST(req: NextRequest) {
  try {
    const host = getHost(req as unknown as Request);
    const body = await req.json();
    const { first_name, last_name, email, phone } = body || {};

    if (!first_name || !last_name) {
      return NextResponse.json(
        { error: "first_name and last_name required" },
        { status: 400 }
      );
    }

    const row = await withTenant(host, async (client) => {
      const { rows } = await client.query(
        `insert into contacts(first_name, last_name, email, phone, tenant_id)
         values ($1,$2,$3,$4, nullif(current_setting('app.tenant_id', true), '')::uuid)
         returning id`,
        [first_name, last_name, email || null, phone || null]
      );
      return rows[0];
    });

    return NextResponse.json({ ok: true, id: row.id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "insert_failed", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
