import type {TaskStatusEnum} from "../TaskStatusEnum";

/** Body of every 202 answer that starts a background task; mirrors TaskAcceptedResponse of vempain-common-api. */
export interface TaskAcceptedResponse {
    task_id: string;
    type: string;
    title: string;
    status: TaskStatusEnum;
    total_steps: number;
}
