// Shared call-transcript normaliser — used by the dashboard call modal and the
// public call share page/API so both render the exact same turns.

export type CallTurn = {
    role: string;
    message: string;
    startTime?: number;
};

const SPEAKER_SPLIT = /(?=(?:AI|User|Assistant|Agent|Bot|Guest|Customer|Caller|System):)/i;
const SPEAKER_MATCH = /^(AI|User|Assistant|Agent|Bot|Guest|Customer|Caller|System):\s*([\s\S]*)/i;

function parseTranscriptString(text: string): CallTurn[] {
    const parts = text.split(SPEAKER_SPLIT);
    if (parts.length <= 1) return [{ role: 'assistant', message: text }];
    const turns: CallTurn[] = [];
    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const markerMatch = trimmed.match(SPEAKER_MATCH);
        if (markerMatch) {
            const roleLabel = markerMatch[1].toLowerCase();
            const role = (roleLabel === 'ai' || roleLabel === 'assistant' || roleLabel === 'agent' || roleLabel === 'bot') ? 'assistant' : 'user';
            turns.push({ role, message: markerMatch[2].trim() });
        } else {
            turns.push({ role: 'assistant', message: trimmed });
        }
    }
    return turns;
}

// Seconds-into-call for a turn. Vapi's `time` is an epoch-ms timestamp, not an
// offset, so anything implausibly large is dropped rather than shown as 28M:00.
function turnOffset(msg: any): number | undefined {
    const v = msg.secondsFromStart ?? msg.time_in_call_secs ?? msg.startTime ?? msg.start_time ?? msg.time ?? msg.timestamp;
    const n = typeof v === 'number' ? v : Number(v);
    return isFinite(n) && n >= 0 && n < 36000 ? n : undefined;
}

export function parseCallTranscript(data: any): CallTurn[] {
    if (!data) return [];
    let rawMessages: any[] = [];
    let transcript = data.transcript;
    // Archived rows sometimes store the array as a JSON string.
    if (typeof transcript === 'string' && transcript.trim().startsWith('[')) {
        try { const parsed = JSON.parse(transcript); if (Array.isArray(parsed)) transcript = parsed; } catch { /* keep string */ }
    }

    if (Array.isArray(transcript) && transcript.length > 0) {
        rawMessages = transcript;
    } else if (Array.isArray(data.messages)) {
        rawMessages = data.messages;
    } else if (data.analysis && Array.isArray(data.analysis.transcript)) {
        rawMessages = data.analysis.transcript;
    } else if (typeof transcript === 'string' && transcript.trim()) {
        return parseTranscriptString(transcript);
    }
    return rawMessages.map((msg: any) => ({
        role: msg.role === 'agent' || msg.role === 'bot' ? 'assistant' : (msg.role || 'user'),
        message: msg.message || msg.content || msg.text || '',
        startTime: turnOffset(msg),
    }));
}

/** Turns worth displaying: no system prompts, no empty lines. */
export function visibleTurns(turns: CallTurn[]): CallTurn[] {
    return turns.filter(t => t.role !== 'system' && t.message.trim() !== '');
}

export function formatOffset(secs: number | undefined): string {
    if (secs === undefined || !isFinite(secs)) return '';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
