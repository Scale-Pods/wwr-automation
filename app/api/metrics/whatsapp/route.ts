import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface WhatsappMetrics {
    totalReachouts: number;
    totalReplies: number;
    replyRate: number;
    dailyTrend: { date: string; reachouts: number; replies: number }[];
    ownerReachouts: number;
    ownerReplies: number;
    introReachouts: number;
    nurtureReachouts: number;
    introReplies: number;
    nurtureReplies: number;
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
    const secretKey   = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!supabaseUrl || !secretKey) {
        return NextResponse.json({ error: 'Config missing' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const fromISO = searchParams.get('from') || new Date(Date.now() - 7 * 86400000).toISOString();
    const toISO   = searchParams.get('to') ? endOfDay(searchParams.get('to')!) : endOfDay(new Date().toISOString());

    // ── Direct Supabase Table Fetching ─────────────────
    const headers: Record<string, string> = {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        'Cache-Control': 'no-store',
    };

    const cols = encodeURIComponent(['"Lead ID"', '"W.P_1"', '"W.P_1 TS"', '"WP_Replied_track"', 'whatsapp_last_contacted', '"Created At"'].join(','));
    const filter = `"W.P_1"=not.is.null&"Created At"=gte.${encodeURIComponent(fromISO)}&"Created At"=lte.${encodeURIComponent(toISO)}`;

    try {
        const [nrWfRows, nurtureRows] = await Promise.all([
            fetchAllPages(`${supabaseUrl}/rest/v1/nr_wf?select=${cols}&${filter}&order="Created At".desc`, headers),
            fetchAllPages(`${supabaseUrl}/rest/v1/nurture?select=${cols}&${filter}&order="Created At".desc`, headers),
        ]);

        function calcStats(rows: any[]) {
            let reachouts = 0, replies = 0;
            const dailyMap: Record<string, { reachouts: number; replies: number }> = {};
            rows.forEach(r => {
                if (!r['W.P_1']) return;
                reachouts++;
                const wp = r['WP_Replied_track'];
                const hasReplied = !!(wp && String(wp).trim() && !['no', 'none'].includes(String(wp).trim().toLowerCase()));
                if (hasReplied) replies++;
                const dateRef = r['W.P_1 TS'] ?? r['whatsapp_last_contacted'] ?? r['Created At'];
                if (dateRef) {
                    const key = new Date(dateRef).toISOString().slice(0, 10);
                    if (!dailyMap[key]) dailyMap[key] = { reachouts: 0, replies: 0 };
                    dailyMap[key].reachouts++;
                    if (hasReplied) dailyMap[key].replies++;
                }
            });
            return { reachouts, replies, dailyMap };
        }

        const intro   = calcStats(nrWfRows);
        const nurture = calcStats(nurtureRows);

        const totalReachouts = intro.reachouts + nurture.reachouts;
        const totalReplies   = intro.replies   + nurture.replies;

        // Merge daily maps
        const mergedDailyMap: Record<string, { reachouts: number; replies: number }> = {};
        [intro.dailyMap, nurture.dailyMap].forEach(dm => {
            Object.entries(dm).forEach(([date, vals]) => {
                if (!mergedDailyMap[date]) mergedDailyMap[date] = { reachouts: 0, replies: 0 };
                mergedDailyMap[date].reachouts += vals.reachouts;
                mergedDailyMap[date].replies   += vals.replies;
            });
        });
        const dailyTrend = Object.entries(mergedDailyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, v]) => ({ date, ...v }));

        const metrics: WhatsappMetrics = {
            totalReachouts,
            totalReplies,
            replyRate: totalReachouts > 0 ? Math.round((totalReplies / totalReachouts) * 100) : 0,
            dailyTrend,
            ownerReachouts: 0,
            ownerReplies:   0,
            introReachouts:   intro.reachouts,
            nurtureReachouts: nurture.reachouts,
            introReplies:     intro.replies,
            nurtureReplies:   nurture.replies,
        };

        return new NextResponse(JSON.stringify(metrics), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    } catch (err: any) {
        console.error('[whatsapp-metrics] fallback error:', err);
        return NextResponse.json({ error: 'Fetch failed', detail: err.message }, { status: 500 });
    }
}
