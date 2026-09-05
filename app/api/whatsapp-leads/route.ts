import { NextResponse } from 'next/server';
import { OUTREACH_TABLE } from '@/lib/outreach-types';

export const dynamic = 'force-dynamic';

function endOfDay(iso: string): string {
    const d = new Date(iso);
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
        d.setUTCHours(23, 59, 59, 999);
    }
    return d.toISOString();
}

const PAGE = 1000;
async function fetchAllPages(baseUrl: string, headers: Record<string, string>) {
    const rows: any[] = [];
    let offset = 0;
    while (true) {
        const url = `${baseUrl}&offset=${offset}&limit=${PAGE}`;
        const res = await fetch(url, { headers, cache: 'no-store' });
        if (!res.ok) throw new Error(`Supabase query failed: ${await res.text()}`);
        const batch: any[] = await res.json();
        rows.push(...batch);
        if (batch.length < PAGE) break;
        offset += PAGE;
    }
    return rows;
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseUrl || !secretKey) {
        return NextResponse.json({ error: 'Config missing' }, { status: 500 });
    }

    const fromISO = from || new Date(Date.now() - 90 * 86400000).toISOString();
    const toISO = to ? endOfDay(to) : endOfDay(new Date().toISOString());

    const headers: Record<string, string> = {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        'Cache-Control': 'no-store',
    };

    // '*' — hardcoding a column list drifts from the live schema (e.g. wa_4 not
    // existing on this instance) and throws 42703. Pulling every column is safe here
    // since only a handful of fields are read downstream.
    const cols = '*';

    try {
        // A lead "has WhatsApp activity" if wa_1 is set OR the conversation jsonb is non-empty.
        const [waLeads, convLeads] = await Promise.all([
            fetchAllPages(
                `${supabaseUrl}/rest/v1/${OUTREACH_TABLE}?select=${encodeURIComponent(cols)}` +
                `&wa_1=not.is.null` +
                `&created_at=gte.${encodeURIComponent(fromISO)}&created_at=lte.${encodeURIComponent(toISO)}` +
                `&order=created_at.desc`,
                headers
            ).catch(() => [] as any[]),
            fetchAllPages(
                `${supabaseUrl}/rest/v1/${OUTREACH_TABLE}?select=${encodeURIComponent(cols)}` +
                `&whatsapp_conversation=not.is.null` +
                `&created_at=gte.${encodeURIComponent(fromISO)}&created_at=lte.${encodeURIComponent(toISO)}` +
                `&order=created_at.desc`,
                headers
            ).catch(() => [] as any[]),
        ]);

        const map = new Map<string, any>();
        [...waLeads, ...convLeads].forEach(r => {
            const id = r.lead_id || r.crm_id || r.phone;
            if (id && !map.has(id)) map.set(id, r);
        });
        const leads = Array.from(map.values());

        return new NextResponse(
            // `leads` is canonical; nr_wf mirrors it for any not-yet-updated caller.
            JSON.stringify({ leads, nr_wf: leads, nurture: [], followup: [], owners: [] }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store, no-cache, must-revalidate',
                },
            }
        );
    } catch (err: any) {
        console.error('[whatsapp-leads] fetch error:', err);
        return NextResponse.json({ error: 'Fetch failed', detail: err.message }, { status: 500 });
    }
}
