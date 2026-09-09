import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Proxy to the n8n "personal ai assistant" workflow (id wexdHHyoPIK0W36O).
 * Keeps the webhook URL server-side and sidesteps browser CORS. The n8n Chat
 * Trigger (webhook mode) expects { action, chatInput, sessionId } and replies
 * with { output }.
 */
const WEBHOOK_URL = process.env.INSIGHTS_ASSISTANT_WEBHOOK_URL || '';

/**
 * The chat widget renders raw text (no Markdown parser), so any stray Markdown
 * from the agent shows literally. Strip the common offenders while keeping the
 * text readable: unwrap bold/italic emphasis, drop heading hashes and backticks,
 * and flatten pipe tables into "col - col - col" lines.
 */
function stripMarkdown(input: string): string {
    if (!input) return input;
    return input
        .split('\n')
        .map((line) => {
            let l = line;
            // pipe-table rows -> " - " separated; drop separator rows (|---|---|)
            if (/^\s*\|.*\|\s*$/.test(l)) {
                if (/^\s*\|?[\s:|-]+\|?\s*$/.test(l)) return null; // separator row
                l = l
                    .replace(/^\s*\|/, '')
                    .replace(/\|\s*$/, '')
                    .split('|')
                    .map((c) => c.trim())
                    .filter(Boolean)
                    .join(' - ');
            }
            // headings: "## Foo" -> "Foo"
            l = l.replace(/^\s{0,3}#{1,6}\s+/, '');
            // bullets: normalise "* " / "+ " to "- "
            l = l.replace(/^(\s*)[*+]\s+/, '$1- ');
            return l;
        })
        .filter((l) => l !== null)
        .join('\n')
        // bold / italic / bold-italic
        .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*\n]+)\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        // inline code / code fences
        .replace(/```[a-z]*\n?/gi, '')
        .replace(/`([^`]+)`/g, '$1')
        // any leftover stray asterisks
        .replace(/\*/g, '')
        // collapse 3+ blank lines
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export async function POST(req: Request) {
    if (!WEBHOOK_URL) {
        return NextResponse.json(
            { error: 'INSIGHTS_ASSISTANT_WEBHOOK_URL is not configured' },
            { status: 500 },
        );
    }

    let body: { message?: string; sessionId?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const message = (body.message || '').trim();
    const sessionId = (body.sessionId || '').trim() || 'anonymous';
    if (!message) {
        return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    try {
        const res = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'sendMessage',
                chatInput: message,
                sessionId,
            }),
            // the agent can take 20-60s to think + query Supabase
            signal: AbortSignal.timeout(180_000),
            cache: 'no-store',
        });

        const text = await res.text();
        if (!res.ok) {
            console.error('[insights-chat] n8n error', res.status, text);
            return NextResponse.json(
                { error: `Assistant workflow returned ${res.status}`, detail: text.slice(0, 500) },
                { status: 502 },
            );
        }

        // n8n replies with JSON { output: "..." } but be defensive.
        let reply = '';
        try {
            const json = JSON.parse(text);
            reply = json.output ?? json.text ?? json.reply ?? json.message ?? '';
        } catch {
            reply = text;
        }

        return NextResponse.json({
            reply: stripMarkdown(reply) || 'No response from the assistant.',
        });
    } catch (err: any) {
        const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
        console.error('[insights-chat] fetch failed', err);
        return NextResponse.json(
            {
                error: isTimeout
                    ? 'The assistant took too long to respond. Try a narrower question.'
                    : 'Failed to reach the assistant.',
            },
            { status: 504 },
        );
    }
}
