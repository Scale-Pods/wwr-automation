// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for WhatsApp + Email numbers.
//
// Every dashboard card (Master, WhatsApp overview / chat / leads / analytics,
// Email overview / sent / received / analytics, and the /api/metrics/* routes)
// must call these functions instead of re-deriving counts, so a number can only
// ever have one definition. All inputs are raw outreach_table rows.
//
// Definitions (a "step" is only real once it has been processed — a bare
// YYYY-MM-DD in a *_sent_at column is just the scheduled day):
//
//  WhatsApp
//    send event        wa_N has text AND (status sent/delivered/read/replied OR
//                      sent_at ends "- Done"); dated by wa_N_sent_at
//    Unique Contacted  leads with >=1 send event inside the range
//    Messages Sent     per contacted lead: max(send events in range, outbound
//                      bubbles in whatsapp_conversation in range), summed
//    Replies           contacted leads that replied (whatsapp_reply_track
//                      positive OR an inbound message in whatsapp_conversation)
//    Positive Leads    contacted leads with wa_sentiment = "hot"
//
//  Email
//    send event        email_N has content AND status is not received/-/blank;
//                      dated by email_N_sent_at (fallback created_at)
//    Emails Sent       send events inside the range
//    Unique Emailed    leads with >=1 send event inside the range
//    Replies           leads with a real email reply (hasEmailReply) whose reply
//                      date (track date → last inbound message → last_activity →
//                      created_at) is inside the range
//    Sentiment / EOI   unique emailed leads, by email_sentiment
// ─────────────────────────────────────────────────────────────────────────────

import {
    coerceTimestamp, parseJsonArray, parseJsonObject, parseQatarDateTime,
    isReplyTrackPositive, isInboundMessage, isOutboundMessage, isHotWaSentiment,
    isEmailSlotSent, hasEmailReply, isEoiEmailSentiment, isPositiveEmailSentiment, isNegativeEmailSentiment,
} from './outreach-types';

export interface MsRange { from: number | null; to: number | null }

/** Build a ms range from two dates, expanded to whole local days. */
export function rangeFromDates(from?: Date | string | null, to?: Date | string | null): MsRange {
    if (!from) return { from: null, to: null };
    const f = new Date(from); f.setHours(0, 0, 0, 0);
    const t = new Date(to || from); t.setHours(23, 59, 59, 999);
    return { from: f.getTime(), to: t.getTime() };
}

/** Same, from ISO strings the client sent (already explicit instants — no re-expansion). */
export function rangeFromISO(from?: string | null, to?: string | null): MsRange {
    const f = from ? new Date(from).getTime() : NaN;
    const t = to ? new Date(to).getTime() : NaN;
    return { from: isNaN(f) ? null : f, to: isNaN(t) ? null : t };
}

export function inRange(ms: number | null | undefined, r: MsRange): boolean {
    if (r.from == null) return true;
    return ms != null && !isNaN(ms) && ms >= r.from && ms <= (r.to ?? Infinity);
}

function toMs(iso: string | null | undefined): number | null {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    return isNaN(t) ? null : t;
}

function fallbackMs(row: any): number | null {
    return toMs(coerceTimestamp(row?.last_activity)) ?? toMs(row?.created_at);
}

// ── WhatsApp ────────────────────────────────────────────────────────────────

const WA_SENT_STATUS_RE = /^(sent|deliver|read|replied)/i;
const DONE_SUFFIX_RE = /-\s*done\s*$/i;

export interface WaEvent { n: number; ms: number | null }

export function waSendEvents(row: any): WaEvent[] {
    const out: WaEvent[] = [];
    for (let n = 1; n <= 8; n++) {
        const message = row?.[`wa_${n}`];
        if (message == null || String(message).trim() === '') continue;
        const status = String(row?.[`wa_${n}_status`] ?? '').trim();
        const sentAt = row?.[`wa_${n}_sent_at`];
        if (!WA_SENT_STATUS_RE.test(status) && !DONE_SUFFIX_RE.test(String(sentAt ?? ''))) continue;
        out.push({ n, ms: toMs(coerceTimestamp(sentAt)) ?? fallbackMs(row) });
    }
    return out;
}

export function waHasReplied(row: any): boolean {
    if (isReplyTrackPositive(row?.whatsapp_reply_track)) return true;
    return parseJsonArray(row?.whatsapp_conversation).some(m => {
        const role = String(m?.role ?? m?.type ?? m?.sender ?? '').toLowerCase();
        return role === 'user' || role === 'customer';
    });
}

function waOutboundBubblesInRange(row: any, r: MsRange): number {
    let c = 0;
    for (const m of parseJsonArray(row?.whatsapp_conversation)) {
        if (!isOutboundMessage(m)) continue;
        const ms = toMs(coerceTimestamp(m?.date || m?.timestamp || m?.created_at || m?.sent_at))
            ?? toMs(parseQatarDateTime(m?.qatar_timestamp));
        if (ms != null && inRange(ms, r)) c++;
    }
    return c;
}

/** First send inside the range, or null when the lead wasn't contacted in it. */
export function waFirstContactInRange(row: any, r: MsRange): number | null {
    const ms = waSendEvents(row).map(e => e.ms).filter((x): x is number => x != null && inRange(x, r));
    return ms.length ? Math.min(...ms) : null;
}

export interface WaStats {
    uniqueContacted: number;
    messagesSent: number;
    replies: number;
    positiveLeads: number;
    contactedRows: any[];
    daily: { date: string; reachouts: number; replies: number }[];
}

export function waStats(rows: any[], r: MsRange): WaStats {
    let messagesSent = 0, replies = 0, positiveLeads = 0;
    const contactedRows: any[] = [];
    const dailyMap: Record<string, { reachouts: number; replies: number }> = {};

    for (const row of rows) {
        const first = waFirstContactInRange(row, r);
        if (first == null) continue;
        contactedRows.push(row);

        const eventsInRange = waSendEvents(row).filter(e => inRange(e.ms, r)).length;
        messagesSent += Math.max(eventsInRange, waOutboundBubblesInRange(row, r));

        const replied = waHasReplied(row);
        if (replied) replies++;
        if (isHotWaSentiment(row?.wa_sentiment)) positiveLeads++;

        const key = new Date(first).toISOString().slice(0, 10);
        (dailyMap[key] ||= { reachouts: 0, replies: 0 }).reachouts++;
        if (replied) dailyMap[key].replies++;
    }

    const daily = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }));
    return { uniqueContacted: contactedRows.length, messagesSent, replies, positiveLeads, contactedRows, daily };
}

// ── Email ───────────────────────────────────────────────────────────────────

export interface EmailEvent { n: number; ms: number | null }

export function emailSendEvents(row: any): EmailEvent[] {
    const out: EmailEvent[] = [];
    for (let n = 1; n <= 8; n++) {
        const content = row?.[`email_${n}`];
        if (content == null || content === '') continue;
        if (!isEmailSlotSent(row?.[`email_${n}_status`])) continue;
        const obj = parseJsonObject(content);
        const ms = toMs(coerceTimestamp(row?.[`email_${n}_sent_at`]))
            ?? toMs(coerceTimestamp(obj?.timestamp))
            ?? toMs(row?.created_at);
        out.push({ n, ms });
    }
    return out;
}

function trackDate(raw: any): string | null {
    if (!raw) return null;
    const m = String(raw).match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*/);
    return m && !isNaN(new Date(m[0]).getTime()) ? m[0] : null;
}

/** When the lead's email reply happened (same precedence the Received page uses). */
export function emailReplyMs(row: any): number | null {
    const tracked = toMs(trackDate(row?.email_reply_track));
    if (tracked != null) return tracked;
    const inbound = parseJsonArray(row?.email_conversation).filter(isInboundMessage);
    for (let i = inbound.length - 1; i >= 0; i--) {
        const m = inbound[i];
        const ms = toMs(coerceTimestamp(m?.date || m?.timestamp || m?.created_at || m?.sent_at))
            ?? toMs(parseQatarDateTime(m?.qatar_timestamp));
        if (ms != null) return ms;
    }
    return toMs(coerceTimestamp(row?.last_activity)) ?? toMs(row?.updated_at) ?? toMs(row?.created_at);
}

export interface EmailStats {
    emailsSent: number;
    uniqueEmailed: number;
    replies: number;
    posSentiment: number;
    negSentiment: number;
    eoiLeads: number;
    perStep: number[];
    emailedRows: any[];
    daily: { date: string; sent: number; replies: number }[];
}

export function emailStats(rows: any[], r: MsRange, include?: (row: any) => boolean): EmailStats {
    let emailsSent = 0, replies = 0, pos = 0, neg = 0, eoi = 0;
    const perStep = [0, 0, 0, 0, 0, 0, 0, 0];
    const emailedRows: any[] = [];
    const dailyMap: Record<string, { sent: number; replies: number }> = {};

    for (const row of rows) {
        if (include && !include(row)) continue;

        const events = emailSendEvents(row).filter(e => inRange(e.ms, r));
        if (events.length) {
            emailedRows.push(row);
            emailsSent += events.length;
            events.forEach(e => {
                perStep[e.n - 1]++;
                const key = new Date(e.ms!).toISOString().slice(0, 10);
                (dailyMap[key] ||= { sent: 0, replies: 0 }).sent++;
            });
            if (isEoiEmailSentiment(row?.email_sentiment)) eoi++;
        }

        if (hasEmailReply(row)) {
            const rms = emailReplyMs(row);
            if (inRange(rms, r)) {
                replies++;
                // Sentiment is a property of the reply, so count it for replies in
                // range — identical to the Received Emails page and the assistant.
                if (isPositiveEmailSentiment(row?.email_sentiment, row?.lead_stage)) pos++;
                if (isNegativeEmailSentiment(row?.email_sentiment, row?.lead_stage)) neg++;
                const key = new Date(rms!).toISOString().slice(0, 10);
                (dailyMap[key] ||= { sent: 0, replies: 0 }).replies++;
            }
        }
    }

    const daily = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }));
    return { emailsSent, uniqueEmailed: emailedRows.length, replies, posSentiment: pos, negSentiment: neg, eoiLeads: eoi, perStep, emailedRows, daily };
}
