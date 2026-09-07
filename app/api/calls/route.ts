import { NextResponse } from 'next/server';
import { OUTREACH_TABLE, VAPI_CALL_LOGS } from '@/lib/outreach-types';
import { countryOf, dialCodeOf, telephonyCost } from '@/lib/telephony-cost';

export const dynamic = 'force-dynamic';

const SUPA_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPA_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SUPA_HEADERS = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` };

/** Build lookup maps from outreach_table so calls can resolve a real lead. */
async function loadLeadIndex(): Promise<{ byLeadId: Map<string, any>; byPhone: Map<string, any> }> {
    const byLeadId = new Map<string, any>();
    const byPhone = new Map<string, any>();
    if (!SUPA_URL || !SUPA_KEY) return { byLeadId, byPhone };
    try {
        const cols = 'lead_id,crm_id,full_name,first_name,last_name,phone,email,lead_status,lead_stage';
        const rows: any[] = [];
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
    return { byLeadId, byPhone };
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

    const { byLeadId, byPhone } = await loadLeadIndex();

    const normalizeRow = (d: any) => {
        const dur = d.duration_seconds || 0;
        const agentCost = Number(d.cost_usd ?? 0);
        const ph = d.customer_phone || 'Unknown';
        const cleanPh = String(ph).replace(/\D/g, '');

        // ── lead_id primary, phone fallback ──────────────────────────────────
        let lead = d.lead_id ? byLeadId.get(String(d.lead_id)) : undefined;
        if (!lead && cleanPh.length >= 6) lead = byPhone.get(cleanPh);

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
            leadStatus: lead ? (lead.lead_status || null) : null,
            leadStage: lead ? (lead.lead_stage || null) : null,
            callSummary: d.summary || '',
            transcript: d.transcript || '',
            recordingUrl: d.recording_url || '',
            status: (d.status === 'ended' || d.status === 'customer-ended-call' || d.status === 'assistant-ended-call' || d.status === 'voicemail')
                ? 'answered'
                : (d.status || 'answered'),
            type: isInbound ? 'Inbound' : 'Outbound',
            isInbound,
            country: countryOf(ph),
            source: d.source === 'elevenlabs' ? 'elevenlabs' : (d.source || 'vapi'),
            vapiAccount: d.vapi_account,
            vapiPipeline: d.vapi_pipeline || null,
            vapiStage: d.vapi_stage || null,
            vapiStatus: d.status,
            assistantId: d.assistantId || null,
            phoneNumber: 'Unknown',
            endedReason: null,
            breakdown: { agent: agentCost, telephony, total: totalCost },
            raw: { id: d.id, startedAt: d.started_at, assistantId: d.assistantId, isInbound, lead_id: d.lead_id },
        };
    };

    try {
        const url = `${baseUrl}/${VAPI_CALL_LOGS}?select=${columns}${dateParam}&order=started_at.desc&limit=${BATCH_SIZE}&offset=0`;
        const res = await fetch(url, { headers: SUPA_HEADERS });
        if (!res.ok) return [];

        const raw = await res.json();
        let rows: any[] = Array.isArray(raw) ? raw : (raw?.value && Array.isArray(raw.value) ? raw.value : []);
        if (rows.length === 0) return [];

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

        return rows.map(normalizeRow);
    } catch {
        return [];
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
