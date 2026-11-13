import { subDays, startOfDay, endOfDay } from "date-fns";

/** Default date filter for every dashboard page: the last 7 days, whole days
 *  (start of day 7 days ago → end of today). Must match DateRangePicker's own
 *  initial "Last 7 days" selection so the label and the data never disagree. */
export function getDefaultRange(): { from: Date; to: Date } {
    const now = new Date();
    return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
}
