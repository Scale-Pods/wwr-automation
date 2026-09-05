import React from "react";

// Public, unauthenticated layout — deliberately outside /dashboard so no
// session gate applies. Only the single shared email conversation is reachable.
export default function EmailShareLayout({ children }: { children: React.ReactNode }) {
    return <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>{children}</div>;
}
