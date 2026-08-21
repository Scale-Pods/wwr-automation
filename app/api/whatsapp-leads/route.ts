import { NextResponse } from 'next/server';

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
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Supabase query failed: ${err}`);
        }
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
    const to   = searchParams.get('to');

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
    const secretKey   = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!supabaseUrl || !secretKey) {
        return NextResponse.json({ error: 'Config missing' }, { status: 500 });
    }

    const fromISO = from || new Date(Date.now() - 90 * 86400000).toISOString();
    const toISO   = to ? endOfDay(to) : endOfDay(new Date().toISOString());

    const headers: Record<string, string> = {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        'Cache-Control': 'no-store',
    };

    const waCols = [
        '"Lead ID"', '"Name"', '"Phone"', '"Email"', '"Country Code"',
        '"W.P_1"', '"W.P_2"', '"W.P_3"', '"W.P_4"',
        '"W.P_1 TS"', '"W.P_2 TS"', '"W.P_3 TS"', '"W.P_4 TS"',
        '"WP_Replied_track"', '"Unsubscribed"', '"Dropped"',
        '"Created At"', '"Updated At"',
        'whatsapp_sentiment', 'whatsapp_note', 'whatsapp_last_contacted',
        'whatsapp_conversation', 'whatsapp_summary', 'whatsapp_message_count',
        'whatsapp_first_message_at', 'whatsapp_context',
        'curr_lead_status',
    ].join(',');

    try {
        const [wp1Leads, convLeads, nurtureLeads] = await Promise.all([
            fetchAllPages(
                `${supabaseUrl}/rest/v1/nr_wf?select=${encodeURIComponent(waCols)}&"W.P_1"=not.is.null&whatsapp_last_contacted=gte.${encodeURIComponent(fromISO)}&whatsapp_last_contacted=lte.${encodeURIComponent(toISO)}&order=whatsapp_last_contacted.desc`,
                headers
            ).catch(() => [] as any[]),

            fetchAllPages(
                `${supabaseUrl}/rest/v1/nr_wf?select=${encodeURIComponent(waCols)}&whatsapp_last_contacted=gte.${encodeURIComponent(fromISO)}&whatsapp_last_contacted=lte.${encodeURIComponent(toISO)}&whatsapp_message_count=gt.0&order=whatsapp_last_contacted.desc`,
                headers
            ).catch(() => [] as any[]),

            fetchAllPages(
                `${supabaseUrl}/rest/v1/nurture?select=${encodeURIComponent(waCols)}&"W.P_1"=not.is.null&whatsapp_last_contacted=gte.${encodeURIComponent(fromISO)}&whatsapp_last_contacted=lte.${encodeURIComponent(toISO)}&order=whatsapp_last_contacted.desc`,
                headers
            ).catch(() => [] as any[]),
        ]);

        const leadsMap = new Map<string, any>();
        [...wp1Leads, ...convLeads, ...nurtureLeads].forEach(r => {
            const id = r['Lead ID'] || r.id || r.Phone;
            if (id && !leadsMap.has(id)) {
                leadsMap.set(id, {
                    ...r,
                    wp1_parsed_date: r['W.P_1 TS'] ? (() => {
                        const d = new Date(String(r['W.P_1 TS']).trim());
                        return isNaN(d.getTime()) ? null : d.toISOString();
                    })() : null,
                });
            }
        });

        const unifiedLeads = Array.from(leadsMap.values());

        return new NextResponse(
            JSON.stringify({ leads: unifiedLeads, nr_wf: unifiedLeads, nurture: [], followup: [], owners: [] }),
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
