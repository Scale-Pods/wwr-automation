"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutGrid } from "lucide-react";
import { EMAIL_BOARD_OPTIONS, type EmailBoardKey } from "@/lib/email-board";

export function EmailBoardFilter({
    value,
    onChange,
    width = 200,
}: {
    value: EmailBoardKey;
    onChange: (v: EmailBoardKey) => void;
    width?: number;
}) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <LayoutGrid style={{ width: 13, height: 13, color: "var(--label-tertiary)" }} />
            <Select value={value} onValueChange={v => onChange(v as EmailBoardKey)}>
                <SelectTrigger style={{ width, height: 36, fontSize: 12 }}>
                    <SelectValue placeholder="Board" />
                </SelectTrigger>
                <SelectContent>
                    {EMAIL_BOARD_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
