import { NextResponse } from 'next/server';
import { OUTREACH_TABLE, VAPI_CALL_LOGS } from '@/lib/outreach-types';
import { countryOf, dialCodeOf, telephonyCost } from '@/lib/telephony-cost';

export const dynamic = 'force-dynamic';

const SUPA_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPA_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SUPA_HEADERS = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` };

/** The three outbound dialer routes. call_route on outreach_table holds one
 *  of these lowercase values; display labels are title-cased in the UI. */
export const CALL_ROUTES = ['commercial', 'business', 'residential'] as const;
export type CallRoute = typeof CALL_ROUTES[number];

/** Normalise any raw route-ish string (call_route column, or the "- D1 -
 *  Commercial" suffix the dialer appends to call_N_status) to one of
 *  CALL_ROUTES, or null if it doesn't match any of them. */
export function normalizeCallRoute(v: any): CallRoute | null {
    const s = String(v || '').trim().toLowerCase();
    if (!s) return null;
    for (const r of CALL_ROUTES) if (s.includes(r)) return r;
    return null;
}

/** A call_N_status value counts as "no-answer/no-connect" when the dialer or
 *  the Maqsam no-connect poller wrote something other than a real "Sent -"
 *  outcome into it — e.g. "No Answer - D1 - Commercial", "Busy - D2 -
 *  Residential", "Failed - D1 - Business". A null/empty status means that
 *  slot was never dialed at all, so it's excluded, not counted as no-answer. */
export function isNoAnswerStatus(v: any): boolean {
    const s = String(v || '').trim();
    if (!s) return false;
    return !/^Sent\b/i.test(s);
}

/** Build lookup maps from outreach_table so calls can resolve a real lead. */
async function loadLeadIndex(): Promise<{ byLeadId: Map<string, any>; byPhone: Map<string, any>; rows: any[] }> {
    const byLeadId = new Map<string, any>();
    const byPhone = new Map<string, any>();
    const rows: any[] = [];
    if (!SUPA_URL || !SUPA_KEY) return { byLeadId, byPhone, rows };
    try {
        const callSlotCols = Array.from({ length: 8 }, (_, i) => i + 1)
            .flatMap(n => [`call_${n}_date`, `call_${n}_status`, `call_${n}_sentiment`, `call_${n}_note`])
            .join(',');
        const cols = `lead_id,crm_id,full_name,first_name,last_name,phone,email,lead_status,lead_stage,call_route,${callSlotCols}`;
        let offset = 0;
        while (true) {
            const res = await fetch(
                `${SUPA_URL}/rest/v1/${OUTREACH_TABLE}?select=${cols}&offset=${offset}&limit=1000`,
                { headers: SUPA_HEADERS, cache: 'no-store' }
            );
            if (!res.ok) break;
            const batch = await res.json();
            if (!Array.isArray(batch) || batch.length === 0) break;
            rows.push(...batch);
            if (batch.length < 1000) break;
            offset += 1000;
        }
        rows.forEach(l => {
            const name = String(l.full_name || [l.first_name, l.last_name].filter(Boolean).join(' ') || '').trim();
            const rec = { ...l, _name: name };
            if (l.lead_id) byLeadId.set(String(l.lead_id), rec);
            if (l.crm_id) byLeadId.set(String(l.crm_id), rec);
            const cp = String(l.phone || '').replace(/\D/g, '');
            if (cp.length >= 6) byPhone.set(cp, rec);
        });
    } catch (e) {
        console.error('[calls] lead index error', e);
    }
    return { byLeadId, byPhone, rows };
}

/**
 * Attempts that never reached Vapi at all (bad number, ring-out, Maqsam
 * busy/failed) never get a vapi_call_logs row — the dialer and the Maqsam
 * no-connect poller only ever write the outcome onto outreach_table's
 * call_N_status/call_N_date. Synthesize a displayable "call" row per such
 * slot directly from those columns so they show up in the Call Logs panel
 * instead of silently vanishing.
 */
function synthesizeNoAnswerCalls(leadRows: any[], fromDate: Date | null, toDate: Date | null): any[] {
    const out: any[] = [];
    for (const l of leadRows) {
        const name = String(l.full_name || [l.first_name, l.last_name].filter(Boolean).join(' ') || '').trim();
        const route = normalizeCallRoute(l.call_route);
        for (let n = 1; n <= 8; n++) {
            const status = l[`call_${n}_status`];
            if (!isNoAnswerStatus(status)) continue;

            const dateRaw = l[`call_${n}_date`];
            if (!dateRaw) continue;
            const started = new Date(dateRaw);
            if (isNaN(started.getTime())) continue;
            if (fromDate && started < fromDate) continue;
            if (toDate && started > toDate) continue;

            const ph = l.phone || 'Unknown';
            out.push({
                id: `noanswer-${l.lead_id || l.crm_id || ph}-${n}`,
                startedAt: started.toISOString(),
                durationSeconds: 0,
                durationMinutes: 0,
                costValue: 0,
                cost: '$0.000',
                agentCost: 0,
                telephonyCost: 0,
                phone: ph,
                dialCode: dialCodeOf(ph),
                name: name || 'Guest',
                leadId: l.lead_id || l.crm_id || null,
                crmId: l.crm_id || null,
                leadStatus: l.lead_status || null,
                leadStage: l.lead_stage || null,
                callSummary: l[`call_${n}_note`] || '',
                transcript: '',
                recordingUrl: '',
                status: 'no-answer',
                endedReason: status,
                type: 'Outbound',
                isInbound: false,
                country: countryOf(ph),
                source: 'maqsam',
                vapiAccount: null,
                vapiPipeline: null,
                vapiStage: null,
                vapiStatus: status,
                assistantId: null,
                phoneNumber: 'Unknown',
                sentiment: l[`call_${n}_sentiment`] || null,
                note: l[`call_${n}_note`] || null,
                callRoute: route,
                callSlot: n,
                isNoAnswer: true,
                breakdown: { agent: 0, telephony: 0, total: 0 },
                raw: { callSlot: n, status, lead_id: l.lead_id },
            });
        }
    }
    return out;
}

async function fetchArchivedCallLogs(fromDate: Date | null, toDate: Date | null): Promise<any[]> {
    if (!SUPA_URL || !SUPA_KEY) return [];
    const baseUrl = `${SUPA_URL}/rest/v1`;

    // vapi_call_logs columns per the new schema
    const columns = [
        'id', 'started_at', 'customer_phone', 'customer_name', 'duration_seconds',
        'status', 'cost_usd', 'source', 'transcript', 'summary', 'recording_url',
        'vapi_account', 'assistantId', 'type', 'lead_id', 'lead_id_found',
        'has_transcript', 'vapi_pipeline', 'vapi_stage',
    ].join(',');
    const BATCH_SIZE = 1000;

    let dateParam = '';
    if (fromDate) dateParam += `&started_at=gte.${fromDate.toISOString()}`;
    if (toDate) {
        const end = new Date(toDate);
        if (end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0) {
            end.setUTCHours(23, 59, 59, 999);
        }
        dateParam += `&started_at=lte.${end.toISOString()}`;
    }

    const { byLeadId, byPhone, rows: leadRows } = await loadLeadIndex();

    const normalizeRow = (d: any) => {
        const dur = d.duration_seconds || 0;
        const agentCost = Number(d.cost_usd ?? 0);
        const ph = d.customer_phone || 'Unknown';
        const cleanPh = String(ph).replace(/\D/g, '');

        // ── lead_id primary, phone fallback ──────────────────────────────────
        let lead = d.lead_id ? byLeadId.get(String(d.lead_id)) : undefined;
        if (!lead && cleanPh.length >= 6) lead = byPhone.get(cleanPh);

        // Sentiment/note live on outreach_table's call_1..8_sentiment/note
        // slots, not on vapi_call_logs — and slot values look like "Positive |
        // Status: Viewing Scheduled". Use the SAME resolved `lead` (lead_id
        // primary, phone fallback) as the rest of this row, rather than
        // re-deriving the match afterward and losing the phone fallback.
        let sentiment: string | null = null;
        let note: string | null = null;
        if (lead) {
            const slots = [
                { sentiment: lead.call_1_sentiment, note: lead.call_1_note },
                { sentiment: lead.call_2_sentiment, note: lead.call_2_note },
                { sentiment: lead.call_3_sentiment, note: lead.call_3_note },
                { sentiment: lead.call_4_sentiment, note: lead.call_4_note },
                { sentiment: lead.call_5_sentiment, note: lead.call_5_note },
                { sentiment: lead.call_6_sentiment, note: lead.call_6_note },
                { sentiment: lead.call_7_sentiment, note: lead.call_7_note },
                { sentiment: lead.call_8_sentiment, note: lead.call_8_note },
            ];
            const chosen = slots.find(s => String(s.sentiment || '').toLowerCase().includes('positive'))
                || slots.find(s => s.sentiment);
            sentiment = chosen?.sentiment || null;
            note = chosen?.note || null;
        }

        const rawName = d.customer_name || '';
        const looksLikeNumber = /^\+?\d[\d\s\-().]{4,}$/.test(String(rawName).trim());
        const resolvedName =
            (lead && lead._name) ? lead._name
            : (rawName && !looksLikeNumber) ? rawName
            : 'Guest';

        const isInbound = d.type === 'inboundPhoneCall' || d.type === 'Inbound';

        // Carrier cost from context/rates.json, billed per started minute.
        const telephony = telephonyCost({
            durationSeconds: dur,
            customerPhone: ph,
            isInbound,
        });
        const totalCost = Math.round((agentCost + telephony) * 1e4) / 1e4;

        return {
            id: d.id,
            startedAt: d.started_at,
            durationSeconds: dur,
            durationMinutes: Math.round((dur / 60) * 100) / 100,
            costValue: totalCost,
            cost: `$${totalCost.toFixed(3)}`,
            agentCost,
            telephonyCost: telephony,
            phone: ph,
            dialCode: dialCodeOf(ph),
            name: resolvedName,
            leadId: lead ? (lead.lead_id || lead.crm_id) : (d.lead_id || null),
            crmId: lead?.crm_id || null,
            leadStatus: lead ? (lead.lead_status || null) : null,
            leadStage: lead ? (lead.lead_stage || null) : null,
            callSummary: d.summary || '',
            transcript: d.transcript || '',
            recordingUrl: d.recording_url || '',
            status: (d.status === 'ended' || d.status === 'customer-ended-call' || d.status === 'assistant-ended-call' || d.status === 'voicemail')
                ? 'answered'
                : (d.status || 'answered'),
            // Raw Vapi end-reason string, kept alongside the collapsed `status`
            // above — pickup/completion-rate logic needs to distinguish
            // assistant-ended-call / customer-ended-call from other end reasons.
            endedReason: d.status || null,
            type: isInbound ? 'Inbound' : 'Outbound',
            isInbound,
            country: countryOf(ph),
            source: d.source === 'elevenlabs' ? 'elevenlabs' : (d.source || 'vapi'),
            vapiAccount: d.vapi_account || null,
            vapiPipeline: d.vapi_pipeline || null,
            vapiStage: d.vapi_stage || null,
            vapiStatus: d.status,
            assistantId: d.assistantId || null,
            phoneNumber: 'Unknown',
            sentiment,
            note,
            callRoute: lead ? normalizeCallRoute(lead.call_route) : null,
            isNoAnswer: false,
            breakdown: { agent: agentCost, telephony, total: totalCost },
            raw: { id: d.id, startedAt: d.started_at, assistantId: d.assistantId, isInbound, lead_id: d.lead_id },
        };
    };

    const noAnswerCalls = synthesizeNoAnswerCalls(leadRows, fromDate, toDate);

    try {
        const url = `${baseUrl}/${VAPI_CALL_LOGS}?select=${columns}${dateParam}&order=started_at.desc&limit=${BATCH_SIZE}&offset=0`;
        const res = await fetch(url, { headers: SUPA_HEADERS });
        if (!res.ok) return noAnswerCalls;

        const raw = await res.json();
        let rows: any[] = Array.isArray(raw) ? raw : (raw?.value && Array.isArray(raw.value) ? raw.value : []);
        if (rows.length === 0) return noAnswerCalls;

        if (rows.length >= BATCH_SIZE) {
            const contentRange = res.headers.get('content-range');
            let totalCount = rows.length;
            if (contentRange) {
                const match = contentRange.match(/\/(\d+)$/);
                if (match) totalCount = parseInt(match[1], 10);
            }
            if (totalCount > rows.length) {
                const remaining: Promise<any[]>[] = [];
                for (let offset = BATCH_SIZE; offset < totalCount; offset += BATCH_SIZE) {
                    const batchUrl = `${baseUrl}/${VAPI_CALL_LOGS}?select=${columns}${dateParam}&order=started_at.desc&limit=${BATCH_SIZE}&offset=${offset}`;
                    remaining.push(fetch(batchUrl, { headers: SUPA_HEADERS }).then(r => r.ok ? r.json() : []).catch(() => []));
                }
                (await Promise.all(remaining)).forEach(b => { if (Array.isArray(b)) rows.push(...b); });
            }
        }

        return [...rows.map(normalizeRow), ...noAnswerCalls];
    } catch {
        return noAnswerCalls;
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');
        const includeElevenLabs = searchParams.get('includeElevenLabs') === 'true';

        const fromDateRaw = fromParam ? new Date(fromParam) : null;
        const toDateRaw = toParam ? new Date(toParam) : null;
        const fromDate = fromDateRaw && !isNaN(fromDateRaw.getTime()) ? fromDateRaw : null;
        const toDate = toDateRaw && !isNaN(toDateRaw.getTime()) ? toDateRaw : null;

        const archivedCalls = await fetchArchivedCallLogs(fromDate, toDate);

        const final = archivedCalls
            .filter((c: any) => includeElevenLabs || (c.vapiAccount !== 'elevenlabs' && c.source !== 'elevenlabs'))
            .sort((a, b) => {
                const ta = a.startedAt ? new Date(a.startedAt).getTime() : 0;
                const tb = b.startedAt ? new Date(b.startedAt).getTime() : 0;
                return tb - ta;
            });

        return new NextResponse(JSON.stringify(final), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            },
        });
    } catch (globalErr) {
        console.error('Global calls API error:', globalErr);
        return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
    }
}
