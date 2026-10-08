import {createContext} from "react";
import type {TaskAcceptedResponse, TaskProgressResponse} from "../models";

export type TaskFinishedCallback<R = unknown> = (task: TaskProgressResponse<R>) => void;

export interface TrackTaskOptions<R = unknown> {
    /** Invoked once, when the task reaches COMPLETED, FAILED or CANCELLED. Receives the final snapshot including the result payload. */
    onFinished?: TaskFinishedCallback<R>;
}

export interface TaskProgressContextValue {
    /** Visible tasks, newest first. Finished tasks stay listed until the user closes their card. */
    tasks: TaskProgressResponse[];
    /** Starts following a task that an endpoint has just accepted (202). */
    trackTask: <R = unknown>(accepted: TaskAcceptedResponse, options?: TrackTaskOptions<R>) => void;
    /**
     * Closes the card of a task. This only hides the card: a running task keeps running in the backend and keeps
     * being polled so that its onFinished callback still fires; a finished task is also dismissed from the backend list.
     */
    closeTask: (taskId: string) => void;
    /** Asks the backend to stop the task and revert the changes it has made so far. */
    cancelTask: (taskId: string) => Promise<void>;
    /** Re-reads the task list of the current user from the backend. */
    refresh: () => Promise<void>;
}

export const taskProgressContext = createContext<TaskProgressContextValue | null>(null);
