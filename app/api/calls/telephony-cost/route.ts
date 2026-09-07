import { NextResponse } from 'next/server';
import { telephonyCost } from '@/lib/telephony-cost';

// Batch telephony-cost lookup. The main /api/calls route already embeds
// breakdown.telephony on every call; this endpoint stays for the voice
// calculator, which recomputes costs for an arbitrary set of calls.
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const calls: any[] = Array.isArray(body?.calls) ? body.calls : [];

        const costs: Record<string, number> = {};
        for (const call of calls) {
            const { id, phoneNumber, phone, durationSeconds, isInbound } = call || {};
            if (id == null) continue;
            costs[id] = telephonyCost({
                durationSeconds,
                customerPhone: phone,
                botPhone: phoneNumber,
                isInbound,
            });
        }

        return NextResponse.json({ success: true, costs });
    } catch (e) {
        console.error('Telephony Cost API error:', e);
        return NextResponse.json({ error: 'Failed to compute telephony costs' }, { status: 500 });
    }
}
