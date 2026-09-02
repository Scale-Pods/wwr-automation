import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MASTER_LEADS_TABLE = 'master_leads';

function endOfDay(iso: string): string {
    const d = new Date(iso);
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
        d.setUTCHours(23, 59, 59, 999);
    }
    return d.toISOString();
}

/**
 * Returns the total count of rows in public.master_leads, optionally scoped by
 * created_at. Uses a HEAD request with Prefer: count=exact so we never pull rows.
 */
export async function GET(req: Request) {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseUrl || !secretKey) {
        return NextResponse.json({ error: 'Config missing' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const isAllMode = !from || from === 'all';

    const headers: Record<string, string> = {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        Prefer: 'count=exact',
        Range: '0-0',
        'Range-Unit': 'items',
        'Cache-Control': 'no-store',
    };

    let url = `${supabaseUrl}/rest/v1/${MASTER_LEADS_TABLE}?select=id`;
    if (!isAllMode) {
        const fromISO = from!;
        const toISO = to ? endOfDay(to) : endOfDay(new Date().toISOString());
        url += `&created_at=gte.${encodeURIComponent(fromISO)}&created_at=lte.${encodeURIComponent(toISO)}`;
    }

    try {
        const res = await fetch(url, { headers, cache: 'no-store' });
        if (!res.ok) {
            const detail = await res.text();
            console.error('[master-leads] count error:', detail);
            return NextResponse.json({ error: 'Fetch failed', detail }, { status: 500 });
        }
        // content-range looks like "0-0/1234" — the total is after the slash
        const cr = res.headers.get('content-range') || '';
        const total = parseInt(cr.split('/').pop() || '0', 10) || 0;

        return new NextResponse(JSON.stringify({ totalLeads: total }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    } catch (err: any) {
        console.error('[master-leads] error:', err);
        return NextResponse.json({ error: 'Fetch failed', detail: err.message }, { status: 500 });
    }
}
