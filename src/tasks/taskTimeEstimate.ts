/** Translation key of a remaining-time text with its interpolation values. */
export interface RemainingTimeText {
    key: "TaskProgress.remainingUnderMinute" | "TaskProgress.remainingMinutes" | "TaskProgress.remainingWholeHours" | "TaskProgress.remainingHours";
    options?: Record<string, number>;
}

/**
 * Turns the backend's remaining-time estimate (`estimated_remaining_seconds`, extrapolated from the pace of the completed steps) into a coarse,
 * readable text: under a minute, whole minutes below an hour, otherwise hours and minutes. Returns null when there is no estimate.
 */
export function remainingTimeText(seconds: number | null | undefined): RemainingTimeText | null {
    if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
        return null;
    }
    if (seconds < 60) {
        return {key: "TaskProgress.remainingUnderMinute"};
    }
    const totalMinutes = Math.round(seconds / 60);
    if (totalMinutes < 60) {
        return {key: "TaskProgress.remainingMinutes", options: {minutes: totalMinutes}};
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) {
        return {key: "TaskProgress.remainingWholeHours", options: {hours}};
    }
    return {key: "TaskProgress.remainingHours", options: {hours, minutes}};
}
