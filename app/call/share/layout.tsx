import React from "react";

// Public, unauthenticated layout — deliberately outside /dashboard so no
// session gate applies. Only the single shared lead's calls are reachable.
// <html> is forced to `.dark`; re-pin the light tokens the shared audio
// player reads so it matches this light page.
const LIGHT_TOKENS = {
    "--fill-secondary": "rgba(120,120,128,0.16)",
    "--fill-tertiary": "rgba(118,118,128,0.12)",
    "--fill-quaternary": "rgba(116,116,128,0.08)",
    "--label-primary": "rgba(0,0,0,0.88)",
    "--label-secondary": "rgba(60,60,67,0.60)",
    "--label-tertiary": "rgba(60,60,67,0.45)",
    "--hairline": "rgba(60,60,67,0.15)",
    "--blue": "#007AFF",
    "--green": "#34C759",
} as React.CSSProperties;

export default function CallShareLayout({ children }: { children: React.ReactNode }) {
    return <div style={{ ...LIGHT_TOKENS, minHeight: "100vh", background: "#f1f5f9", color: "#0f172a" }}>{children}</div>;
}
