import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface MasterMetrics {
    totalLeads: number;
    oldestLeadDate: string | null;
    totalWaReachouts: number;
    totalWaReplies: number;
    totalVoiceCalls: number;
    ownerVoiceCalls: number;
    normalVapiCost: number;
    ownerVapiCost: number;
    leadsDaily: { date: string; leads: number }[];
    totalOwnerLeads: number;
    ownerWaReachouts: number;
    ownerWaReplies: number;
    introLoopLeads: number;
    nurtureLoopLeads: number;
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

    const colsNrWf = encodeURIComponent([
        '"Lead ID"', '"W.P_1"', '"Voice 1"', '"Voice 2"',
        '"WP_Replied_track"', '"Created At"', 'whatsapp_last_contacted',
    ].join(','));

    const colsNurture = encodeURIComponent([
        '"Lead ID"', '"W.P_1"',
        '"W1_voice1"', '"W1_voice2"', '"W2_voice1"', '"W2_voice2"', '"W4_voice1"', '"W4_voice2"',
        '"WP_Replied_track"', '"Created At"', 'whatsapp_last_contacted',
    ].join(','));

    const dateFilter = `"Created At"=gte.${encodeURIComponent(fromISO)}&"Created At"=lte.${encodeURIComponent(toISO)}`;

    try {
        const [nrWfRows, nurtureRows] = await Promise.all([
            fetchAllPages(`${supabaseUrl}/rest/v1/nr_wf?select=${colsNrWf}&${dateFilter}&order="Created At".desc`, headers),
            fetchAllPages(`${supabaseUrl}/rest/v1/nurture?select=${colsNurture}&${dateFilter}&order="Created At".desc`, headers),
        ]);

        const allRows = [...nrWfRows, ...nurtureRows];

        let totalWaReachouts = 0, totalWaReplies = 0, totalVoiceCalls = 0;
        let oldestDate: string | null = null;
        const dailyMap: Record<string, number> = {};

        allRows.forEach(r => {
            if (r['W.P_1']) totalWaReachouts++;
            const wp = r['WP_Replied_track'];
            if (wp && String(wp).trim() && !['no', 'none'].includes(String(wp).trim().toLowerCase())) totalWaReplies++;
            // Voice calls: nr_wf has Voice 1/Voice 2, nurture has W1_voice1 etc.
            if (r['Voice 1']) totalVoiceCalls++;
            if (r['Voice 2']) totalVoiceCalls++;
            if (r['W1_voice1']) totalVoiceCalls++;
            if (r['W1_voice2']) totalVoiceCalls++;
            if (r['W2_voice1']) totalVoiceCalls++;
            if (r['W2_voice2']) totalVoiceCalls++;
            if (r['W4_voice1']) totalVoiceCalls++;
            if (r['W4_voice2']) totalVoiceCalls++;

            const dt = r['Created At'];
            if (dt) {
                if (!oldestDate || dt < oldestDate) oldestDate = dt;
                const key = new Date(dt).toISOString().slice(0, 10);
                dailyMap[key] = (dailyMap[key] || 0) + 1;
            }
        });

        const leadsDaily = Object.entries(dailyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, leads]) => ({ date, leads }));

        const metrics: MasterMetrics = {
            totalLeads: allRows.length,
            oldestLeadDate: oldestDate,
            totalWaReachouts,
            totalWaReplies,
            totalVoiceCalls,
            ownerVoiceCalls: 0,
            normalVapiCost: 0,
            ownerVapiCost: 0,
            leadsDaily,
            totalOwnerLeads: 0,
            ownerWaReachouts: 0,
            ownerWaReplies: 0,
            introLoopLeads:   nrWfRows.length,
            nurtureLoopLeads: nurtureRows.length,
        };

        return new NextResponse(JSON.stringify(metrics), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    } catch (err: any) {
        console.error('[master-metrics] fallback error:', err);
        return NextResponse.json({ error: 'Fetch failed', detail: err.message }, { status: 500 });
    }
}
