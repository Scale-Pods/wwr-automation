import { NextResponse } from 'next/server';
import { OUTREACH_TABLE, hasEmailReply, isEmailSlotSent, isEoiEmailSentiment } from '@/lib/outreach-types';
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

        let sent = 0, replies = 0, posSentiment = 0, negSentiment = 0, eoiLeads = 0, leadsEmailed = 0;
        const perStep = [0, 0, 0, 0, 0, 0, 0, 0];
        const dailyMap: Record<string, { sent: number; replies: number }> = {};

        rows.forEach(r => {
            if (!matchesBoard(r, board)) return;

            // Earliest actually-sent slot's timestamp dates this lead's email
            // activity, mirroring how /api/metrics/whatsapp dates WhatsApp activity.
            let earliestMs: number | null = null;
            let slotsSent = 0;
            const sentSlotIndexes: number[] = [];
            for (let n = 1; n <= 8; n++) {
                const content = r[`email_${n}`];
                const status = r[`email_${n}_status`];
                if (!content || !isEmailSlotSent(status)) continue;
                slotsSent++;
                sentSlotIndexes.push(n);
                const sentAtRaw = r[`email_${n}_sent_at`];
                const ms = sentAtRaw ? new Date(sentAtRaw).getTime() : NaN;
                if (!isNaN(ms) && (earliestMs == null || ms < earliestMs)) earliestMs = ms;
            }

            const replied = hasEmailReply(r);
            // A lead can carry email_sentiment (and an EOI/reply signal) from an
            // inbound-only thread even when we never sent an outbound email_N slot
            // (e.g. someone emailing in cold) — don't gate sentiment/EOI counting
            // behind slotsSent, only the "emails sent" totals need that.
            const hasEmailActivity = slotsSent > 0 || replied || !!r.email_sentiment;
            if (!hasEmailActivity) return;

            const dateRef = earliestMs
                ?? (r.email_reply_track ? new Date(r.email_reply_track.match(/\d{4}-\d{2}-\d{2}T[\d:.]+/)?.[0] || r.created_at || 0).getTime() : null)
                ?? (r.created_at ? new Date(r.created_at).getTime() : null);
            if (dateRef == null || isNaN(dateRef) || dateRef < fromMs || dateRef > toMs) return;

            leadsEmailed++;
            sent += slotsSent;
            sentSlotIndexes.forEach(n => perStep[n - 1]++);

            if (replied) replies++;

            const sentiment = String(r.email_sentiment || '').toLowerCase();
            if (sentiment.includes('positive')) posSentiment++;
            if (sentiment.includes('negative')) negSentiment++;
            if (isEoiEmailSentiment(r.email_sentiment)) eoiLeads++;

            const key = new Date(dateRef).toISOString().slice(0, 10);
            if (!dailyMap[key]) dailyMap[key] = { sent: 0, replies: 0 };
            dailyMap[key].sent += slotsSent;
            if (replied) dailyMap[key].replies++;
        });

        const dailyTrend = Object.entries(dailyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, v]) => ({ date, ...v }));

        const metrics: EmailMetrics = {
            totalEmailsSent: sent,
            totalReplies: replies,
            replyRate: sent > 0 ? Math.round((replies / sent) * 100) : 0,
            totalPosSentiment: posSentiment,
            totalNegSentiment: negSentiment,
            totalEoiLeads: eoiLeads,
            totalLeadsEmailed: leadsEmailed,
            perStep,
            dailyTrend,
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
