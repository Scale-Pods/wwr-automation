import { NextResponse } from 'next/server';
import { OUTREACH_TABLE } from '@/lib/outreach-types';

export const dynamic = 'force-dynamic';

export async function GET() {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    if (!supabaseUrl || !secretKey) {
        return NextResponse.json({ error: "Config missing" }, { status: 500 });
    }

    const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
    const headers = {
        "apikey": secretKey,
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json",
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
        const response = await fetch(`${baseUrl}/${OUTREACH_TABLE}?select=*`, {
            headers,
            cache: 'no-store',
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error('Error fetching outreach_table:', await response.text());
            return NextResponse.json({ outreach: [] });
        }

        const outreach = await response.json();
        // legacy keys kept so old consumers don't crash
        return NextResponse.json({ outreach, nr_wf: outreach, followup: [], nurture: [] });
    } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('Raw fetch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
