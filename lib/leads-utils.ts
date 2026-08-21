export interface RawLeadsResponse {
    nr_wf: any[];
    followup: any[];
    nurture: any[];
    master_leads?: any[];
}

export interface ConsolidatedLead {
    id: string;
    lead_id?: string;
    name: string;
    phone: string;
    email: string;
    replied: string;
    current_loop: string;
    source_loop: string;
    display_loop: string;
    stages_passed: string[];
    stage_data: Record<string, any>;
    created_at: string;
    updated_at: string;
    last_contacted?: string;
    sender_email?: string;
    dropped?: string | boolean;
    email_replied?: string;
    user_email_replied?: string;
    whatsapp_replied?: string;
    "W.P_1 TS"?: string;
    "W.P_2 TS"?: string;
    unsubscribed?: string;
    whatsapp_conversation?: any[];
    whatsapp_summary?: string;
    whatsapp_message_count?: number;
    voice_sentiment?: string;
    voice_note?: string;
    whatsapp_sentiment?: string;
    whatsapp_note?: string;
    call_recording_url?: string;
    call_lead_status?: string;
    curr_lead_status?: string;
    email_sent_at?: string | null;
    email_1_ts?: string | null;
    email_2_ts?: string | null;
    email_3_ts?: string | null;
    [key: string]: any;
}

function getVal(obj: any, keys: string[]) {
    if (!obj) return undefined;
    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    return undefined;
}

function parseEmailTs(val: any): string | null {
    if (!val) return null;
    const s = String(val).trim();
    if (!s) return null;
    // Format: "SENT | 2026-06-29T18:24:50.000Z"
    if (s.includes('|')) {
        const part = s.split('|')[1]?.trim();
        if (part && !isNaN(new Date(part).getTime())) return part;
    }
    // Plain ISO timestamp
    if (!isNaN(new Date(s).getTime())) return s;
    return null;
}

function parseJsonbEmail(val: any): string {
    if (!val) return '';
    const obj = parseJsonbEmailObject(val);
    if (!obj) return String(val);
    return obj.subject || obj.body_text || obj.body_html || obj.body || obj.content || obj.text || JSON.stringify(obj);
}

function parseJsonbEmailObject(val: any): Record<string, any> | null {
    if (!val) return null;
    let parsed = val;
    // Keep parsing until we get an object (handles double/triple encoding)
    for (let i = 0; i < 5; i++) {
        if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch { break; }
        } else {
            break;
        }
    }
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed;
    }
    return null;
}

function getWPHistory(l: any) {
    const history: Record<string, any> = {};
    for (let i = 1; i <= 10; i++) {
        history[`W.P_Replied_${i}`] = l[`W.P_Replied ${i}`] ?? l[`W.P_Replied_${i}`] ?? null;
        history[`W.P_FollowUp_${i}`] = l[`W.P_FollowUp ${i}`] ?? l[`W.P_FollowUp_${i}`] ?? null;
        history[`W.P_FollowUp_TS${i}`] = l[`W.P_FollowUp_TS${i}`] ?? null;
    }
    return history;
}

function parseConversation(raw: any): any[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return []; }
    }
    return [];
}

export function consolidateLeads(data: RawLeadsResponse): ConsolidatedLead[] {
    const result: ConsolidatedLead[] = [];

    // ── 1. nr_wf → Intro Loop ──────────────────────────────────────────────
    if (Array.isArray(data.nr_wf)) {
        data.nr_wf.forEach((l: any, idx: number) => {
            const stages: string[] = [];
            const stage_data: Record<string, any> = {};

            // Email columns are jsonb — extract full object + readable content + timestamp
            let latestEmailTs: string | null = null;
            ['Email_1', 'Email_2', 'Email_3'].forEach(key => {
                const val = l[key];
                if (val !== undefined && val !== null) {
                    const emailObj = parseJsonbEmailObject(val);
                    if (emailObj) {
                        stages.push(key);
                        // Store the full parsed object so UI can access from, to, subject, body_html, etc.
                        stage_data[key] = emailObj;
                        // Extract timestamp from jsonb for date filtering
                        if (emailObj.timestamp) {
                            if (!latestEmailTs || emailObj.timestamp > latestEmailTs) latestEmailTs = emailObj.timestamp;
                        }
                    } else {
                        // Fallback: store as string
                        const parsed = parseJsonbEmail(val);
                        if (parsed) { stages.push(key); stage_data[key] = parsed; }
                    }
                }
            });

            // Also use Email_X_TS columns as fallback timestamps for sent emails
            const emailTsKeys = ['Email 1_TS', 'Email 2_TS', 'Email 3_TS'];
            emailTsKeys.forEach(tsKey => {
                const parsed = parseEmailTs(l[tsKey]);
                if (parsed) {
                    if (!latestEmailTs || parsed > latestEmailTs) latestEmailTs = parsed;
                }
            });

            // Also include text-based email columns (Email 1, Email 2, Email 3) for status display
            ['Email 1', 'Email 2', 'Email 3'].forEach(key => {
                const val = l[key];
                if (val !== undefined && val !== null && String(val).trim()) {
                    const stageKey = key.replace(' ', '_');
                    if (!stages.includes(stageKey)) {
                        stages.push(stageKey);
                        stage_data[stageKey] = String(val);
                    }
                }
            });

            // WhatsApp messages
            ['W.P_1', 'W.P_2', 'W.P_3', 'W.P_4'].forEach((key, i) => {
                if (l[key]) { stages.push(`WhatsApp ${i + 1}`); stage_data[`WhatsApp ${i + 1}`] = l[key]; }
            });

            // Voice calls
            ['Voice 1', 'Voice 2'].forEach(key => {
                if (l[key]) { stages.push(key); stage_data[key] = l[key]; }
            });

            if (l['FollowUp 48 Hr']) {
                stages.push('FollowUp 48 Hr');
                stage_data['FollowUp 48 Hr'] = l['FollowUp 48 Hr'];
            }

            const wpReplied = l['WP_Replied_track'];

            result.push({
                id: `intro-${l['Lead ID'] || idx}`,
                lead_id: l['Lead ID'],
                name: String(l['Name'] || 'Lead'),
                phone: String(l['Phone'] || ''),
                email: String(l['Email'] || 'No Email'),
                replied: String(l['Replied'] || wpReplied || 'No'),
                current_loop: 'Intro',
                source_loop: 'nr_wf',
                display_loop: 'Intro Loop',
                stages_passed: stages,
                stage_data,
                created_at: l['Created At'] || new Date().toISOString(),
                updated_at: l['Updated At'] || l['Created At'] || new Date().toISOString(),
                last_contacted: l['Last Contacted'] ?? undefined,
                sender_email: l['Sender Email'] ?? undefined,
                email_replied: l['Email_Replied'] ?? null,
                user_email_replied: l['user_email_replied'] ?? null,
                whatsapp_replied: wpReplied ?? null,
                dropped: l['Dropped'] ?? undefined,
                unsubscribed: l['Unsubscribed'] ?? 'No',
                WP_Replied_track: wpReplied ?? null,
                wp1_parsed_date: l['W.P_1 TS'] ?? l['whatsapp_last_contacted'] ?? null,
                'W.P_1': l['W.P_1'] ?? null,
                'W.P_2': l['W.P_2'] ?? null,
                'W.P_3': l['W.P_3'] ?? null,
                'W.P_4': l['W.P_4'] ?? null,
                'W.P_1 TS': l['W.P_1 TS'] ?? null,
                'W.P_2 TS': l['W.P_2 TS'] ?? null,
                'W.P_3 TS': l['W.P_3 TS'] ?? null,
                'W.P_4 TS': l['W.P_4 TS'] ?? null,
                voice_sentiment: l.voice_sentiment ?? null,
                voice_note: l.voice_note ?? null,
                whatsapp_sentiment: l.whatsapp_sentiment ?? null,
                whatsapp_note: l.whatsapp_note ?? null,
                call_recording_url: l.call_recording_url ?? null,
                call_lead_status: l.call_lead_status ?? null,
                curr_lead_status: l.curr_lead_status ?? null,
                whatsapp_conversation: parseConversation(l.whatsapp_conversation),
                whatsapp_summary: l.whatsapp_summary ?? null,
                whatsapp_message_count: l.whatsapp_message_count ?? 0,
                whatsapp_last_contacted: l.whatsapp_last_contacted ?? null,
                voice_last_contacted: l.voice_last_contacted ?? null,
                email_bounced: l['Email_Bounced'] ?? false,
                email_bounced_ts: l['Email_Bounced_TS'] ?? null,
                email_replied_ts: l['Email_Replied_TS'] ?? null,
                email_sent_at: latestEmailTs ?? l['Email_Replied_TS'] ?? l['Last Contacted'] ?? null,
                email_1_ts: parseEmailTs(l['Email 1_TS']),
                email_2_ts: parseEmailTs(l['Email 2_TS']),
                email_3_ts: parseEmailTs(l['Email 3_TS']),
                email_reply_summary: l.email_reply_summary ?? null,
                email_reply_reason: l.email_reply_reason ?? null,
                email_sentiment: l.email_sentiment ?? null,
                email_interest_score: l.email_interest_score ?? null,
                enquiry_cluster: l['enquiry_clusterName'] ?? null,
                ...getWPHistory(l),
            });
        });
    }

    // ── 2. followup (legacy — kept for backward compat) ───────────────────
    if (Array.isArray(data.followup)) {
        data.followup.forEach((l: any, idx: number) => {
            const stages: string[] = [];
            const stage_data: Record<string, any> = {};

            for (let i = 1; i <= 3; i++) {
                const key = `Email_${i}`;
                const val = l[key];
                if (val !== undefined && val !== null) {
                    const parsed = parseJsonbEmail(val);
                    if (parsed) { stages.push(key); stage_data[key] = parsed; }
                }
            }

            ['Voice 1', 'Voice 2'].forEach(key => {
                if (l[key]) { stages.push(key); stage_data[key] = l[key]; }
            });

            result.push({
                id: `followup-${l['Lead ID'] || idx}`,
                lead_id: l['Lead ID'],
                name: String(l['Name'] || 'Lead'),
                phone: String(l['Phone'] || ''),
                email: String(l['Email'] || 'No Email'),
                replied: String(l['Replied'] || l['Email_Replied'] || 'No'),
                current_loop: 'Follow Up',
                source_loop: 'followup',
                display_loop: 'Follow Up Loop',
                stages_passed: stages,
                stage_data,
                created_at: l['Created At'] || new Date().toISOString(),
                updated_at: l['Updated At'] || l['Created At'] || new Date().toISOString(),
                last_contacted: l['Last Contacted'] ?? undefined,
                email_replied: l['Email_Replied'] ?? null,
                email_1_ts: parseEmailTs(l['Email 1_TS'] ?? l['Email_1_TS']),
                email_2_ts: parseEmailTs(l['Email 2_TS'] ?? l['Email_2_TS']),
                email_3_ts: parseEmailTs(l['Email 3_TS'] ?? l['Email_3_TS']),
                email_bounced: l['Email_Bounced'] ?? false,
                email_bounced_ts: l['Email_Bounced_TS'] ?? null,
                email_replied_ts: l['Email_Replied_TS'] ?? null,
                unsubscribed: l['Unsubscribed'] ?? 'No',
                WP_Replied_track: l['WP_Replied_track'] ?? null,
                ...getWPHistory(l),
            });
        });
    }

    // ── 3. nurture → Nurture Loop ──────────────────────────────────────────
    if (Array.isArray(data.nurture)) {
        data.nurture.forEach((l: any, idx: number) => {
            const stages: string[] = [];
            const stage_data: Record<string, any> = {};

            // Nurture has up to 9 email columns
            for (let i = 1; i <= 9; i++) {
                const key = `Email_${i}`;
                const val = l[key];
                if (val !== undefined && val !== null) {
                    const emailObj = parseJsonbEmailObject(val);
                    if (emailObj) {
                        stages.push(key);
                        stage_data[key] = emailObj;
                    } else {
                        const parsed = parseJsonbEmail(val);
                        if (parsed) { stages.push(key); stage_data[key] = parsed; }
                    }
                }
            }

            // WhatsApp messages — nurture has up to W.P_12
            for (let i = 1; i <= 12; i++) {
                const key = `W.P_${i}`;
                if (l[key]) { stages.push(`WhatsApp ${i}`); stage_data[`WhatsApp ${i}`] = l[key]; }
            }

            // Voice calls — nurture uses W1_voice1, W1_voice2 etc.
            ['W1_voice1', 'W1_voice2', 'W2_voice1', 'W2_voice2', 'W4_voice1', 'W4_voice2'].forEach(key => {
                if (l[key]) { stages.push(key); stage_data[key] = l[key]; }
            });

            // Week tracking
            let currentWeek = '';
            if (l['Week 3']) currentWeek = 'Week 3';
            else if (l['Week 2']) currentWeek = 'Week 2';
            else if (l['Week 1']) currentWeek = 'Week 1';

            const wpReplied = l['WP_Replied_track'];

            result.push({
                id: `nurture-${l['Lead ID'] || idx}`,
                lead_id: l['Lead ID'],
                name: String(l['Name'] || 'Lead'),
                phone: String(l['Phone'] || ''),
                email: String(l['Email'] || 'No Email'),
                replied: String(l['Replied'] || l['Email_Replied'] || wpReplied || 'No'),
                current_loop: 'Nurture',
                source_loop: 'nurture',
                display_loop: 'Nurture Loop',
                stages_passed: stages,
                stage_data,
                current_week: currentWeek,
                created_at: l['Created At'] || new Date().toISOString(),
                updated_at: l['Updated At'] || l['Created At'] || new Date().toISOString(),
                last_contacted: l['Last Contacted'] ?? undefined,
                sender_email: l['Senders email'] ?? undefined,
                email_replied: l['Email_Replied'] ?? null,
                user_email_replied: l['user_email_replied'] ?? null,
                whatsapp_replied: wpReplied ?? null,
                dropped: l['Dropped'] ?? undefined,
                unsubscribed: l['Unsubscribed'] ?? 'No',
                WP_Replied_track: wpReplied ?? null,
                wp1_parsed_date: l['W.P_1 TS'] ?? l['whatsapp_last_contacted'] ?? null,
                'W.P_1': l['W.P_1'] ?? null,
                'W.P_2': l['W.P_2'] ?? null,
                'W.P_3': l['W.P_3'] ?? null,
                'W.P_4': l['W.P_4'] ?? null,
                'W.P_5': l['W.P_5'] ?? null,
                'W.P_6': l['W.P_6'] ?? null,
                'W.P_7': l['W.P_7'] ?? null,
                'W.P_8': l['W.P_8'] ?? null,
                'W.P_9': l['W.P_9'] ?? null,
                'W.P_10': l['W.P_10'] ?? null,
                'W.P_11': l['W.P_11'] ?? null,
                'W.P_12': l['W.P_12'] ?? null,
                'W.P_1 TS': l['W.P_1 TS'] ?? null,
                'W.P_2 TS': l['W.P_2 TS'] ?? null,
                voice_sentiment: l.voice_sentiment ?? null,
                voice_note: l.voice_note ?? null,
                whatsapp_sentiment: l.whatsapp_sentiment ?? null,
                whatsapp_note: l.whatsapp_note ?? null,
                curr_lead_status: l.curr_lead_status ?? null,
                whatsapp_last_contacted: l.whatsapp_last_contacted ?? null,
                voice_last_contacted: l.voice_last_contacted ?? null,
                email_bounced: l['Email_Bounced'] ?? false,
                email_bounced_ts: l['Email_Bounced_TS'] ?? null,
                email_replied_ts: l['Email_Replied_TS'] ?? null,
                ...getWPHistory(l),
            });
        });
    }

    // ── 4. master_leads ───────────────────────────────────────────────────
    if (Array.isArray((data as any).master_leads)) {
        (data as any).master_leads.forEach((l: any, idx: number) => {
            result.push({
                id: `master-${l['Lead ID'] || idx}`,
                lead_id: l['Lead ID'],
                name: String(l['Name'] || l.name || 'Lead'),
                phone: String(l['Phone'] || l.phone || ''),
                email: String(l['Email'] || l.email || 'No Email'),
                replied: 'No',
                current_loop: 'Master',
                source_loop: 'master',
                display_loop: 'Master Leads',
                stages_passed: [],
                stage_data: {},
                created_at: l['Created At'] || l.created_at || new Date().toISOString(),
                updated_at: l['Updated At'] || l.updated_at || new Date().toISOString(),
                lead_status: l.lead_status || l['Lead Status'],
            });
        });
    }

    return result;
}
