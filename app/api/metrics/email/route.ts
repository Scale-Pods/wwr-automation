import { NextResponse } from 'next/server';
import { OUTREACH_TABLE } from '@/lib/outreach-types';
import { emailStats, rangeFromISO } from '@/lib/channel-metrics';
import { boardOf, matchesBoard, type EmailBoardKey } from '@/lib/email-board';

export const dynamic = 'force-dynamic';

export interface EmailMetrics {
    totalEmailsSent: number;
    totalReplies: number;
    replyRate: number;
    totalPosSentiment: number;
    totalNegSentiment: number;
    totalEoiLeads: number;
    totalLeadsEmailed: number;
    perStep: number[];
    dailyTrend: { date: string; sent: number; replies: number }[];
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
    const board = (searchParams.get('board') || 'all') as EmailBoardKey;

    const headers: Record<string, string> = {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        'Cache-Control': 'no-store',
    };

    // select=* — hardcoding a column list drifts from the live schema (e.g. email_6
    // not existing on this instance) and throws 42703.
    const cols = '*';

    try {
        // email_N_sent_at is free-text, so range-filter on it in JS the same way
        // /api/metrics/whatsapp range-filters wa_N_sent_at. Also pull in leads with
        // no outbound email_N at all but a reply/sentiment signal (e.g. someone who
        // emailed in cold) so EOI/sentiment counts aren't gated on us having sent one.
        const orFilter = encodeURIComponent(
            [...Array.from({ length: 8 }, (_, i) => `email_${i + 1}.not.is.null`), 'email_sentiment.not.is.null', 'email_reply_track.not.is.null'].join(',')
        );
        const rows = await fetchAllPages(
            `${supabaseUrl}/rest/v1/${OUTREACH_TABLE}?select=${cols}&or=(${orFilter})&order=created_at.desc`,
            headers
        );

        const st = emailStats(
            rows,
            rangeFromISO(new Date(fromMs).toISOString(), new Date(toMs).toISOString()),
            r => matchesBoard(r, board),
        );

        const metrics: EmailMetrics = {
            totalEmailsSent: st.emailsSent,
            totalReplies: st.replies,
            replyRate: st.emailsSent > 0 ? Math.round((st.replies / st.emailsSent) * 100) : 0,
            totalPosSentiment: st.posSentiment,
            totalNegSentiment: st.negSentiment,
            totalEoiLeads: st.eoiLeads,
            totalLeadsEmailed: st.uniqueEmailed,
            perStep: st.perStep,
            dailyTrend: st.daily,
        };

        return new NextResponse(JSON.stringify(metrics), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    } catch (err: any) {
        console.error('[email-metrics] error:', err);
        return NextResponse.json({ error: 'Fetch failed', detail: err.message }, { status: 500 });
    }
}
