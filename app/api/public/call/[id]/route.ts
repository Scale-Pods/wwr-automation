import { NextResponse } from 'next/server';
import { OUTREACH_TABLE, VAPI_CALL_LOGS } from '@/lib/outreach-types';
import { parseCallTranscript, visibleTurns } from '@/lib/call-transcript';

export const dynamic = 'force-dynamic';

// Public endpoint — returns ONLY the voice calls (recording + transcript) for
// one lead, keyed by the lead's crm_id (lead_id uuid accepted for older links).
// No email, no raw phone, no other leads. Keep the returned surface minimal.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    let rawId = id;
    try { rawId = decodeURIComponent(id); } catch { /* keep as-is */ }
    rawId = rawId.trim();
    if (!rawId || rawId.length > 200) {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseUrl || !secretKey) {
        return NextResponse.json({ error: 'Config missing' }, { status: 500 });
    }

    const headers = {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
    };
    const base = `${supabaseUrl}/rest/v1`;
    const enc = encodeURIComponent;

    // Single-column queries, each allowed to fail on its own — lead_id may be a
    // uuid column, and a non-uuid value inside or=(...) would reject them all.
    const tryFetch = async (url: string): Promise<any[]> => {
        try {
            const res = await fetch(url, { headers, cache: 'no-store' });
            if (!res.ok) {
                console.error('[public/call] supabase', res.status, await res.text(), '| url:', url);
                return [];
            }
            const rows = await res.json();
            return Array.isArray(rows) ? rows : [];
        } catch (e) {
            console.error('[public/call] fetch error', e);
            return [];
        }
    };

    try {
        // 1. Resolve the lead.
        const leadCols = enc('lead_id,crm_id,full_name,first_name,last_name,phone');
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
        let leads = await tryFetch(`${base}/${OUTREACH_TABLE}?select=${leadCols}&crm_id=eq.${enc(rawId)}&limit=5`);
        if (!leads.length && isUuid) {
            leads = await tryFetch(`${base}/${OUTREACH_TABLE}?select=${leadCols}&lead_id=eq.${enc(rawId)}&limit=5`);
        }
        if (!leads.length) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        const lead = leads[0];

        // 2. Collect this lead's calls: by lead_id (crm_id or uuid), then phone.
        const callCols = enc('id,started_at,duration_seconds,status,transcript,summary,recording_url');
        const callsUrl = (filter: string) =>
            `${base}/${VAPI_CALL_LOGS}?select=${callCols}&${filter}&order=started_at.desc&limit=50`;

        const idKeys = Array.from(new Set(
            leads.flatMap(l => [l.crm_id, l.lead_id]).filter(Boolean).map(String)
        ));
        const phoneTails = Array.from(new Set(
            leads.map(l => String(l.phone || '').replace(/\D/g, '')).filter(p => p.length >= 7).map(p => p.slice(-9))
        ));

        const batches = await Promise.all([
            ...idKeys.map(k => tryFetch(callsUrl(`lead_id=eq.${enc(k)}`))),
            ...phoneTails.map(t => tryFetch(callsUrl(`customer_phone=ilike.*${enc(t)}`))),
        ]);

        const byId = new Map<string, any>();
        for (const row of batches.flat()) {
            if (row?.id && !byId.has(row.id)) byId.set(row.id, row);
        }

        const calls = Array.from(byId.values())
            .map(c => {
                const turns = visibleTurns(parseCallTranscript(c));
                return {
                    id: c.id,
                    startedAt: c.started_at || null,
                    durationSeconds: Number(c.duration_seconds) || 0,
                    summary: c.summary || '',
                    recordingUrl: c.recording_url || null,
                    transcript: turns,
                };
            })
            // Unanswered / empty attempts add nothing to a shared view.
            .filter(c => c.transcript.length > 0 || c.recordingUrl)
            .sort((a, b) => (b.startedAt ? new Date(b.startedAt).getTime() : 0) - (a.startedAt ? new Date(a.startedAt).getTime() : 0));

        const name = String(
            lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Lead'
        ).trim();
        const digits = String(lead.phone || '').replace(/\D/g, '');
        const maskedPhone = digits.length >= 4 ? `•••• ${digits.slice(-4)}` : null;

        return NextResponse.json({ name, phone: maskedPhone, calls }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: any) {
        console.error('[public/call] error:', err);
        return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
    }
}
