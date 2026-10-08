export const TaskStatusEnum = {
    QUEUED: 'QUEUED' as const,
    RUNNING: 'RUNNING' as const,
    /** Cancellation requested; the backend stops at its next checkpoint and reverts the changes made so far */
    CANCELLING: 'CANCELLING' as const,
    /** Stopped on request; every change was reverted */
    CANCELLED: 'CANCELLED' as const,
    COMPLETED: 'COMPLETED' as const,
    FAILED: 'FAILED' as const
};

export type TaskStatusEnum = typeof TaskStatusEnum[keyof typeof TaskStatusEnum];

export function isTaskFinished(status: TaskStatusEnum): boolean {
    return status === TaskStatusEnum.COMPLETED || status === TaskStatusEnum.FAILED || status === TaskStatusEnum.CANCELLED;
}

/** A task that can still be cancelled: queued or running, with no cancellation pending yet. */
export function isTaskCancellable(status: TaskStatusEnum): boolean {
    return status === TaskStatusEnum.QUEUED || status === TaskStatusEnum.RUNNING;
}
