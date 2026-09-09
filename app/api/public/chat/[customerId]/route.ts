import { NextResponse } from 'next/server';
import { consolidateLeads } from "@/lib/leads-utils";
import { OUTREACH_TABLE } from "@/lib/outreach-types";

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ customerId: string }> }) {
    const { customerId } = await params;
    const decodedId = decodeURIComponent(customerId);
    const searchVal = decodedId.toLowerCase().trim();
    const searchPhoneRaw = searchVal.replace(/\D/g, '');
    const searchPhone = (searchPhoneRaw.length >= 7 && searchPhoneRaw.length <= 15) ? searchPhoneRaw : '';

    // strip any legacy id prefix
    const prefixes = ['intro-', 'followup-', 'nurture-', 'master-', 'owner-'];
    let rawId = searchVal;
    for (const p of prefixes) {
        if (searchVal.startsWith(p)) { rawId = searchVal.slice(p.length); break; }
    }

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!supabaseUrl || !secretKey) {
        return NextResponse.json({ error: "Config missing" }, { status: 500 });
    }

    const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
    const headers = {
        "apikey": secretKey,
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json",
    };

    // lead_id is a uuid column — feeding it a non-uuid (e.g. a Zoho crm_id)
    // makes PostgREST reject the whole `or=(...)` with 22P02, so only probe
    // lead_id when rawId actually looks like a uuid.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);

    try {
        const orParts: string[] = [`crm_id.eq.${rawId}`];
        if (isUuid) orParts.push(`lead_id.eq.${rawId}`);
        if (searchPhone) orParts.push(`phone.ilike.*${searchPhone}*`);

        const url = `${baseUrl}/${OUTREACH_TABLE}?select=*&or=(${orParts.join(',')})&limit=25`;
        const res = await fetch(url, { headers, cache: 'no-store' });
        if (!res.ok) {
            console.error('Public API: outreach_table error:', await res.text());
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }
        const rows = await res.json();
        const consolidated = consolidateLeads({ outreach: Array.isArray(rows) ? rows : [] });

        if (consolidated.length > 0) {
            const match = consolidated.find(l =>
                String(l.id).toLowerCase() === searchVal ||
                String(l.crm_id || '').toLowerCase() === searchVal ||
                (searchPhone && String(l.phone).replace(/\D/g, '') === searchPhone)
            ) || consolidated[0];
            return NextResponse.json({ lead: match, owner: null });
        }

        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    } catch (error: any) {
        console.error('Public API: Global error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
