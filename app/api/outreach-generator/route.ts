import { NextResponse } from 'next/server';

const WEBHOOK_URL = 'https://n8n.srv1010832.hstgr.cloud/webhook/outreach-generator';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: `Webhook response error (${response.status}): ${errorText || response.statusText}` },
                { status: response.status }
            );
        }

        let responseData;
        try {
            responseData = await response.json();
        } catch {
            responseData = { message: 'Success (No JSON response)' };
        }

        return NextResponse.json(responseData);
    } catch (error: any) {
        console.error('Error triggering outreach-generator webhook:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to trigger webhook' },
            { status: 500 }
        );
    }
}
