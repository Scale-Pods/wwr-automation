/**
 * Single definition of a "positive" call, shared by Call Logs, Voice overview and Voice
 * analytics. Mirrors the hot-lead rule used in the n8n call workflow:
 *   (sentiment positive OR curious
 *     OR lead_status in {Expression Of Interest, Callback- Plan Postponed,
 *                        Proposal Requested, Viewing Scheduled}
 *     OR lead_stage contains "positive")
 *   AND the call lasted at least 15 seconds.
 */
export const POSITIVE_LEAD_STATUSES = [
    'expression of interest',
    'callback plan postponed',
    'proposal requested',
    'viewing scheduled',
];

const norm = (v: any) => String(v ?? '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();

export function isPositiveStatus(leadStatus: any): boolean {
    const s = norm(leadStatus);
    return !!s && POSITIVE_LEAD_STATUSES.some(p => s === p);
}

export interface PositiveCallInput {
    sentiment?: any;       // call_N_sentiment text, e.g. "Positive | Status: Viewing Scheduled"
    leadStatus?: any;
    leadStage?: any;
    durationSeconds?: any;
}

export function isPositiveCall({ sentiment, leadStatus, leadStage, durationSeconds }: PositiveCallInput): boolean {
    if (!(Number(durationSeconds || 0) >= 15)) return false;
    const sent = String(sentiment ?? '').toLowerCase();
    if (sent.includes('positive') || sent.includes('curious')) return true;
    // The slot text also carries the lead status ("... | Status: Viewing Scheduled").
    const embedded = sent.match(/status:\s*([^|]+)/)?.[1];
    if (isPositiveStatus(leadStatus) || isPositiveStatus(embedded)) return true;
    return /positive/i.test(String(leadStage ?? ''));
}
