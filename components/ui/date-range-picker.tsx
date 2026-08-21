"use client"

import * as React from "react"
import { format, subDays, subMonths, subYears, startOfMonth, endOfMonth, startOfDay } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

export interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
    onUpdate?: (values: { range: DateRange | undefined, label?: string }) => void;
}

export function DateRangePicker({
    className,
    onUpdate,
}: DateRangePickerProps) {
    const [date, setDate] = React.useState<DateRange | undefined>({
        from: subDays(new Date(), 7),
        to: new Date(),
    })

    const [tempDate, setTempDate] = React.useState<DateRange | undefined>(date)
    const [tempLabel, setTempLabel] = React.useState<string | undefined>("Last 7 days")
    const [open, setOpen] = React.useState(false)
    const [isMounted, setIsMounted] = React.useState(false)

    React.useEffect(() => {
        setIsMounted(true)
    }, [])

    React.useEffect(() => {
        if (open) {
            setTempDate(date)
        }
    }, [open, date])

    if (!isMounted) {
        return <div className={cn("h-[38px] w-[220px] rounded-[10px] animate-pulse shrink-0", className)} style={{ background: 'var(--fill-tertiary)' }}></div>
    }

    const presets = [
        {
            label: "Today",
            getValue: () => {
                const today = new Date();
                return { from: startOfDay(today), to: today };
            }
        },
        {
            label: "Last 7 days",
            getValue: () => {
                const today = new Date();
                return { from: startOfDay(subDays(today, 7)), to: today };
            }
        },
        {
            label: "Last 30 days",
            getValue: () => {
                const today = new Date();
                return { from: startOfDay(subDays(today, 30)), to: today };
            }
        },
        {
            label: "This Month",
            getValue: () => {
                const today = new Date();
                return { from: startOfDay(startOfMonth(today)), to: endOfMonth(today) };
            }
        },
        {
            label: "Last 3 Months",
            getValue: () => {
                const today = new Date();
                return { from: startOfDay(subMonths(today, 3)), to: today };
            }
        },
        {
            label: "Last 6 Months",
            getValue: () => {
                const today = new Date();
                return { from: startOfDay(subMonths(today, 6)), to: today };
            }
        },
        {
            label: "Last 1 year",
            getValue: () => {
                const today = new Date();
                return { from: startOfDay(subYears(today, 1)), to: today };
            }
        },
    ];

    const handlePresetChange = (value: string) => {
        const preset = presets.find(p => p.label === value);
        if (preset) {
            setTempDate(preset.getValue());
            setTempLabel(value);
        }
    };

    const handleApply = () => {
        setDate(tempDate);
        setOpen(false);
        if (onUpdate) {
            onUpdate({ range: tempDate, label: tempLabel });
        }
    };

    const handleCancel = () => {
        setOpen(false);
    };

    const handleClear = () => {
        setDate(undefined);
        setTempDate(undefined);
        setTempLabel(undefined);
        if (onUpdate) {
            onUpdate({ range: undefined, label: undefined });
        }
    };

    return (
        <div className={cn("inline-flex shrink-0 w-[230px]", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        className="inline-flex items-center gap-2 px-3 h-[36px] rounded-[10px] bg-[var(--fill-tertiary)] hover:bg-[var(--fill-secondary)] border border-[var(--glass-border)] text-[var(--label-primary)] text-[12px] font-medium tracking-tight transition-all w-full whitespace-nowrap shadow-sm"
                    >
                        <CalendarIcon className="w-3.5 h-3.5 text-[var(--blue)] shrink-0" />
                        <span className="flex-1 text-left truncate">
                            {date?.from ? (
                                date.to ? (
                                    <>
                                        {format(date.from, "MMM dd, yy")} – {format(date.to, "MMM dd, yy")}
                                    </>
                                ) : (
                                    format(date.from, "MMM dd, yyyy")
                                )
                            ) : (
                                <span className="text-[var(--label-tertiary)]">Select date range</span>
                            )}
                        </span>
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-auto p-0 border border-[var(--glass-border)] bg-[var(--bg-layer1)] rounded-[14px] shadow-2xl overflow-hidden z-50 backdrop-blur-xl"
                    align="end"
                    sideOffset={6}
                >
                    <div className="flex flex-col sm:flex-row items-stretch max-h-[80vh] overflow-y-auto sm:overflow-visible">
                        {/* Preset List */}
                        <div className="p-1.5 border-b sm:border-b-0 sm:border-r border-[var(--glass-border)] w-full sm:w-[135px] shrink-0 flex flex-row sm:flex-col gap-0.5 overflow-x-auto sm:overflow-visible bg-[var(--fill-quaternary)]">
                            {presets.map((preset) => (
                                <button
                                    key={preset.label}
                                    onClick={() => handlePresetChange(preset.label)}
                                    className={cn(
                                        "w-auto sm:w-full text-left px-2.5 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors whitespace-nowrap shrink-0",
                                        tempLabel === preset.label
                                            ? "text-[var(--blue)] bg-[var(--blue)]/12 font-semibold"
                                            : "text-[var(--label-secondary)] hover:text-[var(--label-primary)] hover:bg-[var(--fill-tertiary)]"
                                    )}
                                >
                                    {preset.label}
                                </button>
                            ))}
                            <div className="hidden sm:block h-[1px] bg-[var(--glass-border)] my-1" />
                            <button
                                onClick={() => setTempLabel("Custom Range")}
                                className={cn(
                                    "w-auto sm:w-full text-left px-2.5 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors whitespace-nowrap shrink-0",
                                    tempLabel === "Custom Range"
                                        ? "text-[var(--blue)] bg-[var(--blue)]/12 font-semibold"
                                        : "text-[var(--label-tertiary)] hover:text-[var(--label-primary)] hover:bg-[var(--fill-tertiary)]"
                                )}
                            >
                                Custom Range
                            </button>
                        </div>
                        {/* Calendar */}
                        <div className="p-1">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={tempDate?.from}
                                selected={tempDate}
                                onSelect={(val) => {
                                    setTempDate(val);
                                    setTempLabel("Custom Range");
                                }}
                                numberOfMonths={1}
                            />
                        </div>
                    </div>
                    {/* Action Footer */}
                    <div className="p-2.5 border-t border-[var(--glass-border)] flex items-center justify-end gap-2 bg-[var(--fill-quaternary)]">
                        <button
                            onClick={handleClear}
                            className="mr-auto px-3 py-1 rounded-[6px] text-[11px] font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                            Clear
                        </button>
                        <button
                            onClick={handleCancel}
                            className="px-3 py-1 rounded-[6px] text-[11px] font-medium text-[var(--label-secondary)] hover:bg-[var(--fill-tertiary)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            className="px-4 py-1 rounded-[6px] text-[11px] font-semibold text-white bg-[var(--blue)] hover:opacity-90 transition-opacity shadow-sm"
                        >
                            Apply
                        </button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
