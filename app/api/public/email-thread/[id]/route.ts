import { NextResponse } from 'next/server';
import { OUTREACH_TABLE } from '@/lib/outreach-types';

export const dynamic = 'force-dynamic';

// Public endpoint — returns ONLY the email-thread fields for one lead, keyed by
// the lead's email address (or, for older links, lead_id / crm_id). No phone, no
// other PII, no other rows. Keep the returned surface minimal.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const rawId = decodeURIComponent(id).trim();
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

    const cols = 'lead_id,full_name,first_name,last_name,email,email_conversation,email_reply_track,email_sentiment,property_type,property_category';
    const isEmail = rawId.includes('@');

    // Prefer an exact, case-insensitive email match; fall back to lead_id / crm_id
    // so links generated before this change still resolve.
    const orParts = isEmail
        ? [`email.ilike.${encodeURIComponent(rawId)}`]
        : [`lead_id.eq.${encodeURIComponent(rawId)}`, `crm_id.eq.${encodeURIComponent(rawId)}`];
    const url = `${supabaseUrl}/rest/v1/${OUTREACH_TABLE}?select=${encodeURIComponent(cols)}&or=(${orParts.join(',')})&order=updated_at.desc&limit=10`;

    try {
        const res = await fetch(url, { headers, cache: 'no-store' });
        if (!res.ok) {
            console.error('[public/email-thread] supabase error:', await res.text());
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        const rows = await res.json();
        const list: any[] = Array.isArray(rows) ? rows : [];
        // When matching by email, prefer the row that actually has an email conversation.
        const row = list.find(r => {
            const c = r?.email_conversation;
            return Array.isArray(c) ? c.length > 0 : !!c;
        }) || list[0];
        if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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
        return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
    }
}
