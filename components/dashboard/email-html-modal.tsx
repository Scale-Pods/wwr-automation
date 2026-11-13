"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { emailFrameHtml } from "@/lib/email-content";

/** Rendered content height of a same-document (srcDoc) iframe. */
function readFrameHeight(frame: HTMLIFrameElement | null): number | null {
    try {
        const doc = frame?.contentWindow?.document;
        return doc?.body ? doc.body.scrollHeight + 4 : null;
    } catch {
        return null;
    }
}

/**
 * Full email in a centered modal. Width = min(680px, screen − 24px); height follows the
 * email and scrolls inside the card when taller than 88% of the screen. The frame
 * re-measures on load and on resize/rotation so it stays correct on every device.
 */
export function EmailHtmlModal({ html, open, onOpenChange }: { html: string; open: boolean; onOpenChange: (v: boolean) => void }) {
    const ref = useRef<HTMLIFrameElement>(null);
    const [height, setHeight] = useState(560);

    const measure = useCallback(() => {
        const h = readFrameHeight(ref.current);
        if (h) setHeight(Math.min(3000, h));
    }, []);

    useEffect(() => {
        if (!open) return;
        window.addEventListener("resize", measure);
        window.addEventListener("orientationchange", measure);
        return () => {
            window.removeEventListener("resize", measure);
            window.removeEventListener("orientationchange", measure);
        };
    }, [open, measure]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-24px)] max-w-[680px] max-h-[88dvh] overflow-hidden p-0 gap-0 rounded-2xl">
                <DialogHeader className="sr-only"><DialogTitle>Email content</DialogTitle></DialogHeader>
                <div style={{ maxHeight: "88dvh", overflowY: "auto", overflowX: "hidden", background: "#eef0f3", scrollbarGutter: "stable both-edges" }}>
                    <iframe
                        ref={ref}
                        srcDoc={emailFrameHtml(html)}
                        onLoad={measure}
                        title="Email content"
                        style={{ width: "100%", height, border: "none", background: "#eef0f3", display: "block" }}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
