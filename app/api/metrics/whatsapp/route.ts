import { NextResponse } from 'next/server';
import { OUTREACH_TABLE } from '@/lib/outreach-types';
import { waStats, rangeFromISO } from '@/lib/channel-metrics';

export const dynamic = 'force-dynamic';

export interface WhatsappMetrics {
    totalReachouts: number;
    totalReplies: number;
    replyRate: number;
    totalMessagesSent: number;
    totalPositiveLeads: number;
    dailyTrend: { date: string; reachouts: number; replies: number }[];
    // legacy keys — 0 now that owner/loop split is gone
    ownerReachouts: number;
    ownerReplies: number;
}

function endOfDay(iso: string): string {
    const d = new Date(iso);
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
        d.setUTCHours(23, 59, 59, 999);
    }
    return d.toISOString();
}

const PAGE = 1000;
async function fetchAllPages(url: string, headers: Record<string, string>) {
    const rows: any[] = [];
    let offset = 0;
    while (true) {
        const res = await fetch(`${url}&offset=${offset}&limit=${PAGE}`, { headers, cache: 'no-store' });
        if (!res.ok) throw new Error(await res.text());
        const batch: any[] = await res.json();
        rows.push(...batch);
        if (batch.length < PAGE) break;
        offset += PAGE;
    }
    return rows;
}

export async function GET(req: Request) {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseUrl || !secretKey) {
        return NextResponse.json({ error: 'Config missing' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const fromMs = searchParams.get('from') ? new Date(searchParams.get('from')!).getTime() : Date.now() - 7 * 86400000;
    const toMs = searchParams.get('to') ? new Date(endOfDay(searchParams.get('to')!)).getTime() : Date.now();

    const headers: Record<string, string> = {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        'Cache-Control': 'no-store',
    };

    // select=* — hardcoding a column list drifts from the live schema (e.g. wa_4 not
    // existing on this instance) and throws 42703. Pulling every column is safe here
    // since only a handful of fields are read below.
    const cols = '*';

    try {
        // wa_N_sent_at is free-text "DD/MM/YYYY HH:MM" (or "YYYY-MM-DD HH:MM - Done").
        // Fetch every lead with any WhatsApp send (wa_1..wa_8, not just wa_1 — a
        // lead's first send can live in a later slot) and range-filter on the
        // earliest sent timestamp in JS.
        const orFilter = encodeURIComponent(
            Array.from({ length: 8 }, (_, i) => `wa_${i + 1}.not.is.null`).join(',')
        );
        const rows = await fetchAllPages(
            `${supabaseUrl}/rest/v1/${OUTREACH_TABLE}?select=${cols}&or=(${orFilter})&order=created_at.desc`,
            headers
        );

        const st = waStats(rows, rangeFromISO(new Date(fromMs).toISOString(), new Date(toMs).toISOString()));

        const metrics: WhatsappMetrics = {
            totalReachouts: st.uniqueContacted,
            totalReplies: st.replies,
            replyRate: st.uniqueContacted > 0 ? Math.round((st.replies / st.uniqueContacted) * 100) : 0,
            totalMessagesSent: st.messagesSent,
            totalPositiveLeads: st.positiveLeads,
            dailyTrend: st.daily,
            ownerReachouts: 0,
            ownerReplies: 0,
        };

        return new NextResponse(JSON.stringify(metrics), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    } catch (err: any) {
        console.error('[whatsapp-metrics] error:', err);
        return NextResponse.json({ error: 'Fetch failed', detail: err.message }, { status: 500 });
    }
}
