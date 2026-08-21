import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function endOfDay(iso: string): string {
    const d = new Date(iso);
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
        d.setUTCHours(23, 59, 59, 999);
    }
    return d.toISOString();
}

const PAGE = 1000;

async function fetchAllPages(baseUrl: string, headers: Record<string, string>) {
    const rows: any[] = [];
    let offset = 0;
    while (true) {
        const url = `${baseUrl}&offset=${offset}&limit=${PAGE}`;
        const res = await fetch(url, { headers, cache: 'no-store' });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Supabase query failed: ${err}`);
        }
        const batch: any[] = await res.json();
        rows.push(...batch);
        if (batch.length < PAGE) break;
        offset += PAGE;
    }
    return rows;
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to   = searchParams.get('to');

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
    const secretKey   = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!supabaseUrl || !secretKey) {
        return NextResponse.json({ error: 'Config missing' }, { status: 500 });
    }

    const isAllMode = from === 'all';
    const fromISO = isAllMode ? null : (from || new Date(Date.now() - 90 * 86400000).toISOString());
    const toISO   = isAllMode ? null : (to ? endOfDay(to) : endOfDay(new Date().toISOString()));

    const headers: Record<string, string> = {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        'Cache-Control': 'no-store',
    };

    try {
        // Select all relevant columns from nr_wf (Intro Loop)
        const nrWfCols = [
            '"Lead ID"', '"Name"', '"Phone"', '"Email"', '"Country Code"',
            '"Replied"', '"Last Contacted"', '"Created At"', '"Updated At"',
            '"W.P_1"', '"W.P_2"', '"W.P_3"', '"W.P_4"',
            '"W.P_1 TS"', '"W.P_2 TS"', '"W.P_3 TS"', '"W.P_4 TS"',
            '"W.P_Replied 1"', '"W.P_FollowUp 1"', '"W.P_Replied 2"', '"W.P_FollowUp 2"',
            '"W.P_Replied 3"', '"W.P_FollowUp 3"', '"W.P_Replied 4"', '"W.P_FollowUp 4"',
            '"W.P_Replied 5"', '"W.P_FollowUp 5"', '"W.P_Replied 6"', '"W.P_FollowUp 6"',
            '"W.P_Replied 7"', '"W.P_FollowUp 7"', '"W.P_Replied 8"', '"W.P_FollowUp 8"',
            '"W.P_Replied 9"', '"W.P_FollowUp 9"', '"W.P_Replied 10"', '"W.P_FollowUp 10"',
            '"W.P_FollowUp_TS1"', '"W.P_FollowUp_TS2"', '"W.P_FollowUp_TS3"',
            '"W.P_FollowUp_TS4"', '"W.P_FollowUp_TS5"', '"W.P_FollowUp_TS6"',
            '"W.P_FollowUp_TS7"', '"W.P_FollowUp_TS8"', '"W.P_FollowUp_TS9"', '"W.P_FollowUp_TS10"',
            '"Email_1"', '"Email_2"', '"Email_3"',
            '"Email 1_TS"', '"Email 2_TS"', '"Email 3_TS"',
            '"Email_Replied"', '"Email_Bounced"', '"Email_Bounced_TS"', '"Email_Replied_TS"',
            '"Voice 1"', '"Voice 2"',
            '"Sender Email"', '"Dropped"', '"Dropped_Reason"', '"Unsubscribed"',
            '"WP_Replied_track"', '"Call_replied_track"',
            'voice_sentiment', 'voice_note', 'whatsapp_sentiment', 'whatsapp_note',
            'voice_last_contacted', 'whatsapp_last_contacted',
            'curr_lead_status', 'call_recording_url', 'call_lead_status',
            'whatsapp_conversation', 'whatsapp_summary', 'whatsapp_message_count',
            'whatsapp_first_message_at', 'whatsapp_context',
            'email_reply_summary', 'email_reply_reason', 'email_interest_score', 'email_sentiment',
            'callback_date', '"enquiry_clusterName"',
            'user_email_replied',
        ].join(',');

        const nurtureCols = [
            '"Lead ID"', '"Name"', '"Phone"', '"Email"', '"Country Code"',
            '"Replied"', '"Last Contacted"', '"Created At"', '"Updated At"',
            '"W.P_1"', '"W.P_2"', '"W.P_3"', '"W.P_4"', '"W.P_5"', '"W.P_6"',
            '"W.P_7"', '"W.P_8"', '"W.P_9"', '"W.P_10"', '"W.P_11"', '"W.P_12"',
            '"W.P_1 TS"', '"W.P_2 TS"', '"W.P_3 TS"', '"W.P_4 TS"',
            '"W.P_5 TS"', '"W.P_6 TS"', '"W.P_7 TS"', '"W.P_8 TS"',
            '"W.P_9 TS"', '"W.P_10 TS"', '"W.P_11 TS"', '"W.P_12 TS"',
            '"W.P_Replied 1"', '"W.P_FollowUp 1"', '"W.P_Replied 2"', '"W.P_FollowUp 2"',
            '"W.P_Replied 3"', '"W.P_FollowUp 3"', '"W.P_Replied 4"', '"W.P_FollowUp 4"',
            '"W.P_Replied 5"', '"W.P_FollowUp 5"', '"W.P_Replied 6"', '"W.P_FollowUp 6"',
            '"W.P_Replied 7"', '"W.P_FollowUp 7"', '"W.P_Replied 8"', '"W.P_FollowUp 8"',
            '"W.P_Replied 9"', '"W.P_FollowUp 9"', '"W.P_Replied 10"', '"W.P_FollowUp 10"',
            '"W.P_FollowUp_TS1"', '"W.P_FollowUp_TS2"', '"W.P_FollowUp_TS3"',
            '"W.P_FollowUp_TS4"', '"W.P_FollowUp_TS5"',
            '"Email_1"', '"Email_2"', '"Email_3"', '"Email_4"', '"Email_5"',
            '"Email_6"', '"Email_7"', '"Email_8"', '"Email_9"',
            '"Email_Replied"', '"Email_Bounced"', '"Email_Bounced_TS"', '"Email_Replied_TS"',
            '"Week 1"', '"Week 2"', '"Week 3"',
            '"Senders email"', '"Dropped"', '"Dropped_Reason"', '"Unsubscribed"',
            '"WP_Replied_track"', '"Call_replied_track"',
            'voice_sentiment', 'voice_note', 'whatsapp_sentiment', 'whatsapp_note',
            'voice_last_contacted', 'whatsapp_last_contacted',
            'curr_lead_status',
            '"W1_voice1"', '"W1_voice2"', '"W2_voice1"', '"W2_voice2"', '"W4_voice1"', '"W4_voice2"',
        ].join(',');

        const nrWfDateFilter = isAllMode ? '' : `&"Created At"=gte.${encodeURIComponent(fromISO!)}&"Created At"=lte.${encodeURIComponent(toISO!)}`;
        const nurtureDateFilter = isAllMode ? '' : `&"Created At"=gte.${encodeURIComponent(fromISO!)}&"Created At"=lte.${encodeURIComponent(toISO!)}`;

        // Fetch each table independently — one failing doesn't break the other
        const [nr_wf, nurture] = await Promise.all([
            fetchAllPages(
                `${supabaseUrl}/rest/v1/nr_wf?select=${encodeURIComponent(nrWfCols)}${nrWfDateFilter}&order="Created At".desc`,
                headers
            ).catch(err => { console.error('[leads] nr_wf fetch error:', err.message); return []; }),
            fetchAllPages(
                `${supabaseUrl}/rest/v1/nurture?select=${encodeURIComponent(nurtureCols)}${nurtureDateFilter}&order="Created At".desc`,
                headers
            ).catch(err => { console.error('[leads] nurture fetch error:', err.message); return []; }),
        ]);

        return new NextResponse(
            JSON.stringify({ nr_wf, followup: [], nurture, master_leads: [] }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store, no-cache, must-revalidate',
                },
            }
        );
    } catch (err: any) {
        console.error('[leads] fetch error:', err);
        return NextResponse.json({ error: 'Fetch failed', detail: err.message }, { status: 500 });
    }
}
