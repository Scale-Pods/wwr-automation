import { NextResponse } from 'next/server';
import { OUTREACH_TABLE } from '@/lib/outreach-types';

export const dynamic = 'force-dynamic';

// Public endpoint — returns ONLY the email-thread fields for one lead, keyed by
// the lead's email address (or, for older links, lead_id / crm_id). No phone, no
// other PII, no other rows. Keep the returned surface minimal.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    // App Router already url-decodes route params; decode again defensively for
    // double-encoded links, then normalise.
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
        'Cache-Control': 'no-store',
    };

    const cols = 'lead_id,crm_id,full_name,first_name,last_name,email,email_conversation,email_reply_track,email_sentiment,property_type,property_category';
    const selectQ = encodeURIComponent(cols);
    const base = `${supabaseUrl}/rest/v1/${OUTREACH_TABLE}`;
    const isEmail = rawId.includes('@');

    // Build the candidate query URLs. Using single-column filters (not or=(...))
    // so values containing dots/@ aren't mis-parsed by PostgREST's or() grammar.
    const urls: string[] = isEmail
        ? [
            // case-insensitive exact match on email
            `${base}?select=${selectQ}&email=ilike.${encodeURIComponent(rawId)}&order=updated_at.desc&limit=10`,
          ]
        : [
            `${base}?select=${selectQ}&lead_id=eq.${encodeURIComponent(rawId)}&limit=1`,
            `${base}?select=${selectQ}&crm_id=eq.${encodeURIComponent(rawId)}&limit=1`,
          ];

    try {
        let list: any[] = [];
        for (const url of urls) {
            const res = await fetch(url, { headers, cache: 'no-store' });
            if (!res.ok) {
                const body = await res.text();
                console.error('[public/email-thread] supabase', res.status, body, '| url:', url);
                continue;
            }
            const rows = await res.json();
            if (Array.isArray(rows) && rows.length) { list = rows; break; }
        }

        if (!list.length) {
            return NextResponse.json({ error: 'Not found', key: rawId }, { status: 404 });
        }

        // Prefer the row that actually has an email conversation.
        const hasConv = (r: any) => {
            const c = r?.email_conversation;
            if (Array.isArray(c)) return c.length > 0;
            if (typeof c === 'string') return c.trim() !== '' && c.trim() !== '[]';
            return !!c;
        };
        const row = list.find(hasConv) || list[0];

        const name = String(
            row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Lead'
        ).trim();

        return NextResponse.json({
            name,
            email: row.email || null,
            email_conversation: row.email_conversation ?? [],
            email_reply_track: row.email_reply_track ?? null,
            email_sentiment: row.email_sentiment ?? null,
            property_type: row.property_type ?? null,
            property_category: row.property_category ?? null,
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: any) {
        console.error('[public/email-thread] error:', err);
        return NextResponse.json({ error: 'Fetch failed', detail: String(err?.message || err) }, { status: 500 });
    }
}
