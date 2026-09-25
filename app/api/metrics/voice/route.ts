import { NextResponse } from 'next/server';
import { telephonyCost } from '@/lib/telephony-cost';

export const dynamic = 'force-dynamic';

export interface VoiceMetrics {
    totalCalls: number;
    totalDuration: number;
    avgDuration: number;
    totalCost: number;
    avgCost: number;
    completedCalls: number;
    answeredCalls: number;
    successRate: number;
    // Overall (not board-split) rates across every call in range — the real
    // metrics the Voice Analytics cards read. "Completed" means the call
    // ended via status assistant-ended-call or customer-ended-call.
    pickupRate: number;
    completionRate: number;
    positiveRate: number;
    b2bCalls: number;
    b2cCalls: number;
    b2bConnected: number;
    b2bQualified: number;
    b2bPickupRate: number;
    b2bCompletionRate: number;
    b2bPositiveCount: number;
    b2bPositiveRate: number;
    b2cConnected: number;
    b2cQualified: number;
    b2cPickupRate: number;
    b2cCompletionRate: number;
    b2cPositiveCount: number;
    b2cPositiveRate: number;
    allTimeB2bCalls: number;
    allTimeB2cCalls: number;
    dailyVolume: { date: string; calls: number; cost: number }[];
    hourlyDistribution: { hour: number; calls: number }[];
    durationBuckets: { label: string; calls: number }[];
    costByDay: { date: string; calls: number; cost: number }[];
    positiveCount: number;
    recordingCount: number;
    sentimentBreakdown: { positive: number; negative: number; neutral: number };
}

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
        const res = await fetch(`${baseUrl}&offset=${offset}&limit=${PAGE}`, { headers, cache: 'no-store' });
        if (!res.ok) throw new Error(await res.text());
        const batch: any[] = await res.json();
        rows.push(...batch);
        if (batch.length < PAGE) break;
        offset += PAGE;
    }
    return rows;
}

function getSuccessStatus(status: string | null): boolean {
    if (!status) return false;
    const s = status.toLowerCase();
    return s === 'ended' || s === 'customer-ended-call' || s === 'assistant-ended-call' || s === 'voicemail';
}

/** A call "completed" only when it ended via a real conversation end reason —
 *  either side hanging up on a live call — not voicemail, error, or any other
 *  end reason. Used for both pickup and completion rate. */
function isCompletedCall(status: string | null): boolean {
    if (!status) return false;
    const s = status.toLowerCase();
    return s === 'assistant-ended-call' || s === 'customer-ended-call';
}

export async function GET(req: Request) {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
    const secretKey   = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!supabaseUrl || !secretKey) {
        return NextResponse.json({ error: 'Config missing' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get('from');
    const toParam   = searchParams.get('to');

    const fromISO = fromParam || new Date(Date.now() - 7 * 86400000).toISOString();
    const toISO   = toParam ? endOfDay(toParam) : endOfDay(new Date().toISOString());

    const headers: Record<string, string> = {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        'Cache-Control': 'no-store',
    };

    const cols = [
        'id', 'started_at', 'customer_phone', 'customer_name', 'duration_seconds',
        'status', 'cost_usd', 'vapi_account', 'recording_url', 'assistantId', 'type', 'lead_id',
    ].join(',');

    const dateFilter = `&started_at=gte.${encodeURIComponent(fromISO)}&started_at=lte.${encodeURIComponent(toISO)}`;

    // All-time count (no date filter)
    const allTimeCols = ['id', 'started_at', 'duration_seconds', 'status', 'cost_usd', 'vapi_account', 'recording_url'].join(',');

    try {
        const [datedRows, allTimeRows, leadRows] = await Promise.all([
            fetchAllPages(
                `${supabaseUrl}/rest/v1/vapi_call_logs?select=${cols}${dateFilter}&order=started_at.desc`,
                headers
            ),
            fetchAllPages(
                `${supabaseUrl}/rest/v1/vapi_call_logs?select=${allTimeCols}&order=started_at.desc`,
                headers
            ),
            fetchAllPages(
                `${supabaseUrl}/rest/v1/outreach_table?select=lead_id,crm_id,phone,call_1_sentiment,call_2_sentiment,call_3_sentiment,call_4_sentiment`,
                headers
            ).catch(() => [] as any[]),
        ]);

        // Sentiment lives on outreach_table's call_1..4_sentiment slots, not on
        // vapi_call_logs itself, and slot values look like "Positive | Status:
        // Viewing Scheduled" — every call belonging to a lead shares that
        // lead's overall sentiment: positive if ANY of call_1/2/3/4_sentiment
        // contains "positive" (case-insensitive). lead_id on vapi_call_logs
        // doesn't always match outreach_table's lead_id/crm_id, so fall back to
        // matching by phone number, same as /api/calls does.
        const leadByKey = new Map<string, any>();
        const leadByPhone = new Map<string, any>();
        for (const l of leadRows) {
            if (l.lead_id) leadByKey.set(String(l.lead_id), l);
            if (l.crm_id) leadByKey.set(String(l.crm_id), l);
            const cp = String(l.phone || '').replace(/\D/g, '');
            if (cp.length >= 6) leadByPhone.set(cp, l);
        }
        const sentimentById = new Map<string, string | null>();
        for (const r of datedRows) {
            let lead = r.lead_id ? leadByKey.get(String(r.lead_id)) : undefined;
            if (!lead) {
                const cp = String(r.customer_phone || '').replace(/\D/g, '');
                if (cp.length >= 6) lead = leadByPhone.get(cp);
            }
            if (!lead) continue;
            const slots = [lead.call_1_sentiment, lead.call_2_sentiment, lead.call_3_sentiment, lead.call_4_sentiment];
            const positiveSlot = slots.find(s => String(s || '').toLowerCase().includes('positive'));
            sentimentById.set(r.id, positiveSlot || slots.find(Boolean) || null);
        }

        // ── Aggregate dated rows ──────────────────────────────────────────
        let totalCalls = 0, totalDuration = 0, totalCost = 0;
        let completedCalls = 0, answeredCalls = 0, positiveCount = 0, recordingCount = 0;
        let sentimentPos = 0, sentimentNeg = 0, sentimentNeutral = 0;
        // Overall pickup/completion — "completed" = real conversation end reason.
        let overallCompletedCount = 0;
        const dailyMap: Record<string, { calls: number; cost: number }> = {};
        const hourlyMap: Record<number, number> = {};
        const durationBuckets = [
            { label: '0-15s', min: 0, max: 15, count: 0 },
            { label: '15-30s', min: 15, max: 30, count: 0 },
            { label: '30-60s', min: 30, max: 60, count: 0 },
            { label: '1-2m', min: 60, max: 120, count: 0 },
            { label: '2-5m', min: 120, max: 300, count: 0 },
            { label: '5m+', min: 300, max: Infinity, count: 0 },
        ];

        let b2bCalls = 0, b2cCalls = 0;
        let b2bConnected = 0, b2cConnected = 0;
        let b2bCompleted = 0, b2cCompleted = 0;
        let b2bPositiveCount = 0, b2cPositiveCount = 0;

        datedRows.forEach((r: any) => {
            const dur = r.duration_seconds || 0;
            const isInboundRow = r.type === 'inboundPhoneCall' || r.type === 'Inbound';
            const telephony = telephonyCost({ durationSeconds: dur, customerPhone: r.customer_phone, isInbound: isInboundRow });
            const cost = (r.cost_usd || 0) + telephony;
            const account = (r.vapi_account || '').toUpperCase();
            const isSuccess = getSuccessStatus(r.status);
            const isCompleted = isCompletedCall(r.status);
            const isB2b = account === 'B2B';
            const isB2c = account === 'B2C';

            totalCalls++;
            totalDuration += dur;
            totalCost += cost;
            if (r.recording_url) recordingCount++;

            if (isSuccess) {
                completedCalls++;
                answeredCalls++;
            }
            if (isCompleted) overallCompletedCount++;

            // Sentiment comes from the lead's call_N_sentiment slot, joined by
            // lead_id + chronological call order (see sentimentById above).
            const sentiment = String(sentimentById.get(r.id) || '').toLowerCase();
            const isPositive = sentiment.includes('positive');
            if (isPositive) { sentimentPos++; positiveCount++; }
            else if (sentiment.includes('negative')) sentimentNeg++;
            else sentimentNeutral++;

            if (isB2b) {
                b2bCalls++;
                // Pickup = the call reached a live conversation end, not just duration.
                if (isCompleted) b2bConnected++;
                if (isCompleted) b2bCompleted++;
                if (isPositive) b2bPositiveCount++;
            } else if (isB2c) {
                b2cCalls++;
                if (isCompleted) b2cConnected++;
                if (isCompleted) b2cCompleted++;
                if (isPositive) b2cPositiveCount++;
            }

            // Daily volume
            if (r.started_at) {
                const dayKey = new Date(r.started_at).toISOString().slice(0, 10);
                if (!dailyMap[dayKey]) dailyMap[dayKey] = { calls: 0, cost: 0 };
                dailyMap[dayKey].calls++;
                dailyMap[dayKey].cost += cost;
            }

            // Hourly distribution
            if (r.started_at) {
                const hour = new Date(r.started_at).getUTCHours();
                hourlyMap[hour] = (hourlyMap[hour] || 0) + 1;
            }

            // Duration buckets
            for (const bucket of durationBuckets) {
                if (dur >= bucket.min && dur < bucket.max) {
                    bucket.count++;
                    break;
                }
            }
        });

        // ── All-time aggregation ──────────────────────────────────────────
        let allTimeB2bCalls = 0, allTimeB2cCalls = 0;
        allTimeRows.forEach((r: any) => {
            const account = (r.vapi_account || '').toUpperCase();
            if (account === 'B2B') allTimeB2bCalls++;
            else if (account === 'B2C') allTimeB2cCalls++;
        });

        // ── Build response ────────────────────────────────────────────────
        const dailyVolume = Object.entries(dailyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, d]) => ({ date, calls: d.calls, cost: d.cost }));

        const hourlyDistribution = Array.from({ length: 24 }, (_, h) => ({
            hour: h,
            calls: hourlyMap[h] || 0,
        }));

        const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
        const avgCost = totalCalls > 0 ? totalCost / totalCalls : 0;
        const successRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0;
        // Pickup rate and completion rate are the same definition here — both
        // measure "reached a real conversation end" (assistant/customer ended
        // the call), across every call in range, not just a B2B/B2C subset.
        const overallRate = totalCalls > 0 ? Math.round((overallCompletedCount / totalCalls) * 1000) / 10 : 0;
        const overallPositiveRate = totalCalls > 0 ? Math.round((sentimentPos / totalCalls) * 1000) / 10 : 0;

        const metrics: VoiceMetrics = {
            totalCalls,
            totalDuration,
            avgDuration,
            totalCost,
            avgCost,
            completedCalls,
            answeredCalls,
            successRate: Math.round(successRate * 10) / 10,
            pickupRate: overallRate,
            completionRate: overallRate,
            positiveRate: overallPositiveRate,
            b2bCalls,
            b2cCalls,
            b2bConnected,
            b2bQualified: b2bPositiveCount,
            b2bPickupRate: b2bCalls > 0 ? Math.round((b2bConnected / b2bCalls) * 1000) / 10 : 0,
            b2bCompletionRate: b2bCalls > 0 ? Math.round((b2bCompleted / b2bCalls) * 1000) / 10 : 0,
            b2bPositiveCount: b2bPositiveCount,
            b2bPositiveRate: b2bCalls > 0 ? Math.round((b2bPositiveCount / b2bCalls) * 1000) / 10 : 0,
            b2cConnected,
            b2cQualified: b2cPositiveCount,
            b2cPickupRate: b2cCalls > 0 ? Math.round((b2cConnected / b2cCalls) * 1000) / 10 : 0,
            b2cCompletionRate: b2cCalls > 0 ? Math.round((b2cCompleted / b2cCalls) * 1000) / 10 : 0,
            b2cPositiveCount: b2cPositiveCount,
            b2cPositiveRate: b2cCalls > 0 ? Math.round((b2cPositiveCount / b2cCalls) * 1000) / 10 : 0,
            allTimeB2bCalls,
            allTimeB2cCalls,
            dailyVolume,
            hourlyDistribution,
            durationBuckets: durationBuckets.map(b => ({ label: b.label, calls: b.count })),
            costByDay: dailyVolume,
            positiveCount,
            recordingCount,
            sentimentBreakdown: { positive: sentimentPos, negative: sentimentNeg, neutral: sentimentNeutral },
        };

        return new NextResponse(JSON.stringify(metrics), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    } catch (err: any) {
        console.error('[voice-metrics] error:', err);
        return NextResponse.json({ error: 'Fetch failed', detail: err.message }, { status: 500 });
    }
}
