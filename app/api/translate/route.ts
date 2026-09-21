import { NextResponse } from 'next/server';

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

function extractJsonArray(raw: string): any {
    const trimmed = raw.trim();
    const start = trimmed.indexOf('[');
    const end = trimmed.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('No JSON array found in response');
    return JSON.parse(trimmed.slice(start, end + 1));
}

export async function POST(req: Request) {
    try {
        const { text, texts } = await req.json();

        const apiKey = process.env.ANTHROPIC_API_KEY;

        if (!apiKey) {
            // Fallback for development if no key
            if (texts && Array.isArray(texts)) {
                return NextResponse.json({ translatedTexts: texts.map(t => t + " (Mock)") });
            }
            return NextResponse.json({ translatedText: text + " (Mock)" });
        }

        if (texts && Array.isArray(texts)) {
            // Bulk translation
            const prompt = `Translate the following list of messages to English. If a message is already in English, return it unchanged. Maintain the exact same order and array length. Respond with ONLY a JSON array of translated strings, no other text.\n\nMessages:\n${JSON.stringify(texts)}`;

            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01"
                },
                body: JSON.stringify({
                    model: ANTHROPIC_MODEL,
                    max_tokens: 4096,
                    temperature: 0.1,
                    messages: [{ role: "user", content: prompt }]
                })
            });

            if (!response.ok) throw new Error(`Anthropic API failed: ${response.status} ${await response.text()}`);
            const data = await response.json();
            const content = data.content?.[0]?.text ?? '[]';
            const translatedTexts = extractJsonArray(content);
            return NextResponse.json({ translatedTexts });
        }

        const prompt = `Translate the following text to English. If it is already in English, return it as is. Output ONLY the translated text, no preamble or explanation.\n\nText: ${text}`;

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: ANTHROPIC_MODEL,
                max_tokens: 1024,
                temperature: 0.3,
                messages: [{ role: "user", content: prompt }]
            })
        });

        if (!response.ok) throw new Error(`Anthropic API failed: ${response.status} ${await response.text()}`);
        const data = await response.json();
        const translatedText = (data.content?.[0]?.text ?? '').trim();

        return NextResponse.json({ translatedText });
    } catch (error) {
        console.error("Translate API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
