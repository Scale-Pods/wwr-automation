import { NextResponse } from 'next/server';
import { OUTREACH_TABLE, VAPI_CALL_LOGS, isReplyTrackPositive } from '@/lib/outreach-types';

export const dynamic = 'force-dynamic';

export interface MasterMetrics {
    totalLeads: number;
    oldestLeadDate: string | null;
    totalWaReachouts: number;
    totalWaReplies: number;
    totalEmailsSent: number;
    totalEmailReplies: number;
    totalVoiceCalls: number;
    voiceCallCost: number;
    leadsDaily: { date: string; leads: number }[];
    // kept for any component still reading these keys
    ownerVoiceCalls: number;
    normalVapiCost: number;
    ownerVapiCost: number;
    totalOwnerLeads: number;
    ownerWaReachouts: number;
    ownerWaReplies: number;
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

    const outreachCols = encodeURIComponent([
        'created_at',
        'wa_1', 'wa_2', 'wa_3', 'wa_4', 'wa_1_sent_at',
        'whatsapp_reply_track',
        'email_1', 'email_2', 'email_3', 'email_4', 'email_5',
        'email_reply_track',
    ].join(','));

    const outreachFilter =
        `created_at=gte.${encodeURIComponent(fromISO)}&created_at=lte.${encodeURIComponent(toISO)}`;

    const callCols = encodeURIComponent(['id', 'started_at', 'cost_usd'].join(','));
    const callFilter =
        `started_at=gte.${encodeURIComponent(fromISO)}&started_at=lte.${encodeURIComponent(toISO)}`;

    try {
        const [rows, callRows] = await Promise.all([
            fetchAllPages(`${supabaseUrl}/rest/v1/${OUTREACH_TABLE}?select=${outreachCols}&${outreachFilter}&order=created_at.desc`, headers),
            fetchAllPages(`${supabaseUrl}/rest/v1/${VAPI_CALL_LOGS}?select=${callCols}&${callFilter}&order=started_at.desc`, headers)
                .catch(() => [] as any[]),
        ]);

        let totalWaReachouts = 0, totalWaReplies = 0;
        let totalEmailsSent = 0, totalEmailReplies = 0;
        let oldestDate: string | null = null;
        const dailyMap: Record<string, number> = {};

        rows.forEach(r => {
            const hasWa = !!(r.wa_1 || r.wa_2 || r.wa_3 || r.wa_4);
            if (hasWa) totalWaReachouts++;
            if (isReplyTrackPositive(r.whatsapp_reply_track)) totalWaReplies++;

            for (let n = 1; n <= 5; n++) if (r[`email_${n}`]) totalEmailsSent++;
            if (isReplyTrackPositive(r.email_reply_track)) totalEmailReplies++;

            const dt = r.created_at;
            if (dt) {
                if (!oldestDate || dt < oldestDate) oldestDate = dt;
                const key = new Date(dt).toISOString().slice(0, 10);
                dailyMap[key] = (dailyMap[key] || 0) + 1;
            }
        });

        let voiceCallCost = 0;
        callRows.forEach(c => { voiceCallCost += Number(c.cost_usd) || 0; });

        const leadsDaily = Object.entries(dailyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, leads]) => ({ date, leads }));

        const metrics: MasterMetrics = {
            totalLeads: rows.length,
            oldestLeadDate: oldestDate,
            totalWaReachouts,
            totalWaReplies,
            totalEmailsSent,
            totalEmailReplies,
            totalVoiceCalls: callRows.length,
            voiceCallCost,
            leadsDaily,
            ownerVoiceCalls: 0,
            normalVapiCost: voiceCallCost,
            ownerVapiCost: 0,
            totalOwnerLeads: 0,
            ownerWaReachouts: 0,
            ownerWaReplies: 0,
        };

        return new NextResponse(JSON.stringify(metrics), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    } catch (err: any) {
        console.error('[master-metrics] error:', err);
        return NextResponse.json({ error: 'Fetch failed', detail: err.message }, { status: 500 });
    }
}
