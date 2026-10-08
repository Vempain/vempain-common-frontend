import type {TaskStatusEnum} from "../TaskStatusEnum";

/**
 * Progress snapshot of a background task; mirrors TaskProgressResponse of vempain-common-api.
 * The result payload depends on the task type and is only present once the task has completed.
 * A cancelled task has reverted the changes it made before the cancellation.
 */
export interface TaskProgressResponse<R = unknown> {
    task_id: string;
    type: string;
    title: string;
    status: TaskStatusEnum;
    total_steps: number;
    completed_steps: number;
    failed_steps: number;
    percent: number;
    cancel_requested: boolean;
    reverted_steps: number;
    message: string | null;
    error_message: string | null;
    result: R | null;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
}
