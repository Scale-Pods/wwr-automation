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
    const to = searchParams.get('to');

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!supabaseUrl || !secretKey) {
        return NextResponse.json({ error: 'Config missing' }, { status: 500 });
    }

    const isAllMode = from === 'all' || !from;
    const fromISO = isAllMode ? null : from!;
    const toISO = isAllMode ? null : (to ? endOfDay(to) : endOfDay(new Date().toISOString()));

    const headers: Record<string, string> = {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        'Cache-Control': 'no-store',
    };

    // outreach_table.created_at is timestamptz — filter on it when a range is given.
    const dateFilter = isAllMode
        ? ''
        : `&created_at=gte.${encodeURIComponent(fromISO!)}&created_at=lte.${encodeURIComponent(toISO!)}`;

    try {
        const rows = await fetchAllPages(
            `${supabaseUrl}/rest/v1/${OUTREACH_TABLE}?select=*${dateFilter}&order=created_at.desc`,
            headers
        ).catch(err => { console.error('[leads] outreach_table fetch error:', err.message); return []; });

        return new NextResponse(
            // `outreach` is the new key; `nr_wf` mirrors it so any not-yet-updated
            // legacy consumer still gets data.
            JSON.stringify({ outreach: rows, nr_wf: rows, followup: [], nurture: [], master_leads: [] }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store, no-cache, must-revalidate',
                },
            }
        );
    } catch (err: any) {
        console.error('[leads] fetch error:', err);
        return NextResponse.json({ error: 'Fetch failed', detail: err.message }, { status: 500 });
    }
}
