import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Proxy to the n8n "stop / resume bot conversation" webhook.
 * The frontend "Bot Control" button posts { crmId, action } where action is
 * "stop" or "resume"; we forward the lead's crm_id and the action to n8n.
 */
const WEBHOOK_URL = process.env.BOT_CONTROL_WEBHOOK_URL || '';

export async function POST(req: Request) {
    if (!WEBHOOK_URL) {
        return NextResponse.json(
            { error: 'BOT_CONTROL_WEBHOOK_URL is not configured' },
            { status: 500 },
        );
    }

    let body: { crmId?: string; crm_id?: string; action?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const crm_id = String(body.crmId ?? body.crm_id ?? '').trim();
    const action = String(body.action ?? '').trim().toLowerCase();

    if (!crm_id) {
        return NextResponse.json({ error: 'crm_id is required' }, { status: 400 });
    }
    if (action !== 'stop' && action !== 'resume') {
        return NextResponse.json(
            { error: 'action must be "stop" or "resume"' },
            { status: 400 },
        );
    }

    try {
        const res = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                crm_id,
                action,
                // a couple of aliases so the n8n side can read whichever it expects
                bot_status: action === 'stop' ? 'stopped' : 'active',
                source: 'wwr-dashboard',
                requested_at: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(30_000),
            cache: 'no-store',
        });

        const text = await res.text();
        if (!res.ok) {
            console.error('[bot-control] n8n error', res.status, text);
            return NextResponse.json(
                { error: `Webhook returned ${res.status}`, detail: text.slice(0, 300) },
                { status: 502 },
            );
        }

        return NextResponse.json({
            ok: true,
            crm_id,
            action,
            message:
                action === 'stop'
                    ? 'Bot conversation stopped for this lead.'
                    : 'Bot conversation resumed for this lead.',
        });
    } catch (err: any) {
        const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
        console.error('[bot-control] fetch failed', err);
        return NextResponse.json(
            {
                error: isTimeout
                    ? 'The bot-control webhook timed out.'
                    : 'Failed to reach the bot-control webhook.',
            },
            { status: 504 },
        );
    }
}
