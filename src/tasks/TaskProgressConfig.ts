/** How often running tasks are polled from the backend. */
export const TASK_POLL_INTERVAL_MS = 1500;

/** Session storage key of the task ids whose cards the user has closed, so a reload does not bring them back. */
export const CLOSED_TASKS_STORAGE_KEY = "vempain.tasks.closed";

export function readClosedTaskIds(): Set<string> {
    try {
        const stored = window.sessionStorage.getItem(CLOSED_TASKS_STORAGE_KEY);
        return new Set<string>(stored ? JSON.parse(stored) as string[] : []);
    } catch {
        return new Set<string>();
    }
}

export function writeClosedTaskIds(ids: Set<string>): void {
    try {
        window.sessionStorage.setItem(CLOSED_TASKS_STORAGE_KEY, JSON.stringify([...ids]));
    } catch {
        // Session storage is optional
    }
}
