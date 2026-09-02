import { NextResponse } from 'next/server';
import { OUTREACH_TABLE, isReplyTrackPositive, coerceTimestamp } from '@/lib/outreach-types';

export const dynamic = 'force-dynamic';

export interface WhatsappMetrics {
    totalReachouts: number;
    totalReplies: number;
    replyRate: number;
    totalMessagesSent: number;
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
    const fromISO = searchParams.get('from') || new Date(Date.now() - 7 * 86400000).toISOString();
    const toISO = searchParams.get('to') ? endOfDay(searchParams.get('to')!) : endOfDay(new Date().toISOString());

    const headers: Record<string, string> = {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        'Cache-Control': 'no-store',
    };

    const cols = encodeURIComponent([
        'created_at',
        'wa_1', 'wa_1_sent_at', 'wa_2', 'wa_2_sent_at', 'wa_3', 'wa_3_sent_at', 'wa_4', 'wa_4_sent_at',
        'wa_1_status', 'wa_2_status', 'wa_3_status', 'wa_4_status',
        'whatsapp_reply_track', 'whatsapp_conversation', 'last_activity',
    ].join(','));

    // Only leads that got at least a first WhatsApp message, within range.
    const filter =
        `wa_1=not.is.null&created_at=gte.${encodeURIComponent(fromISO)}&created_at=lte.${encodeURIComponent(toISO)}`;

    try {
        const rows = await fetchAllPages(
            `${supabaseUrl}/rest/v1/${OUTREACH_TABLE}?select=${cols}&${filter}&order=created_at.desc`,
            headers
        );

        let reachouts = 0, replies = 0, messagesSent = 0;
        const dailyMap: Record<string, { reachouts: number; replies: number }> = {};

        rows.forEach(r => {
            reachouts++;
            for (let n = 1; n <= 4; n++) if (r[`wa_${n}`]) messagesSent++;

            const replied = isReplyTrackPositive(r.whatsapp_reply_track);
            if (replied) replies++;

            const dateRef = coerceTimestamp(r.wa_1_sent_at) || r.last_activity || r.created_at;
            if (dateRef) {
                const key = new Date(dateRef).toISOString().slice(0, 10);
                if (!dailyMap[key]) dailyMap[key] = { reachouts: 0, replies: 0 };
                dailyMap[key].reachouts++;
                if (replied) dailyMap[key].replies++;
            }
        });

        const dailyTrend = Object.entries(dailyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, v]) => ({ date, ...v }));

        const metrics: WhatsappMetrics = {
            totalReachouts: reachouts,
            totalReplies: replies,
            replyRate: reachouts > 0 ? Math.round((replies / reachouts) * 100) : 0,
            totalMessagesSent: messagesSent,
            dailyTrend,
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
