"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import * as React from "react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: CalendarProps) {
    const defaultClassNames = {
        months: "relative flex flex-col sm:flex-row gap-[16px]",
        month: "w-full",
        caption: "relative flex h-[32px] items-center justify-center mx-[32px] mb-[4px]",
        caption_label: "text-[13px] font-semibold text-[var(--label-primary)]",
        nav: "absolute top-0 flex w-full justify-between",
        nav_button: cn(
            buttonVariants({ variant: "ghost" }),
            "!h-[28px] !w-[28px] !p-0 !min-w-0 text-[var(--label-tertiary)] hover:text-[var(--label-primary)] hover:bg-[var(--fill-tertiary)]",
        ),
        nav_button_previous: "",
        nav_button_next: "",
        table: "border-collapse",
        head_row: "flex",
        head_cell: "w-[32px] h-[32px] p-0 text-[11px] font-medium text-[var(--label-tertiary)] flex items-center justify-center",
        row: "flex mt-[4px]",
        cell: "w-[32px] h-[32px] p-0 text-center text-[12px] relative",
        day: cn(
            buttonVariants({ variant: "ghost" }),
            "!h-[32px] !w-[32px] !p-0 !min-w-0 font-normal rounded-[8px] text-[12px] text-[var(--label-primary)] hover:bg-[var(--fill-tertiary)] hover:text-[var(--label-primary)] aria-selected:opacity-100",
        ),
        day_today: "bg-[var(--fill-secondary)] text-[var(--blue)] font-bold",
        day_selected: "bg-[var(--blue)] text-white font-semibold hover:bg-[var(--blue)] hover:text-white",
        day_range_start: "rounded-e-none",
        day_range_end: "rounded-s-none",
        day_range_middle: "rounded-none bg-[var(--blue)]/15 text-[var(--label-primary)]",
        day_outside: "text-[var(--label-tertiary)]",
        day_disabled: "text-[var(--label-tertiary)] line-through opacity-50",
        day_hidden: "invisible",
    }

    const mergedClassNames: typeof defaultClassNames = Object.keys(defaultClassNames).reduce(
        (acc, key) => ({
            ...acc,
            [key]: classNames?.[key as keyof typeof classNames]
                ? cn(
                    defaultClassNames[key as keyof typeof defaultClassNames],
                    classNames[key as keyof typeof classNames],
                )
                : defaultClassNames[key as keyof typeof defaultClassNames],
        }),
        {} as typeof defaultClassNames,
    )

    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn("p-3", className)}
            classNames={mergedClassNames}
            components={{
                IconLeft: () => <ChevronLeft size={16} strokeWidth={2} />,
                IconRight: () => <ChevronRight size={16} strokeWidth={2} />,
            }}
            {...props}
        />
    )
}
Calendar.displayName = "Calendar"

export { Calendar }
