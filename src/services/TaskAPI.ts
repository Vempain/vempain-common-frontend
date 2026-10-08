import {AbstractAPI} from "@vempain/vempain-auth-frontend";
import type {TaskProgressResponse} from "../models";

/**
 * Progress callback API of background tasks (the /tasks endpoints of vempain-common-core, hosted by every backend that runs
 * background tasks). Tasks are private to the user who started them. Hosts create one instance per backend, for example
 * {@code new TaskAPI(apiUrl, "/tasks")}, and hand it to the {@code TaskProgressProvider}.
 */
export class TaskAPI extends AbstractAPI<unknown, TaskProgressResponse> {
    /** Running and recently finished tasks of the current user, newest first. */
    public async getTasks(): Promise<TaskProgressResponse[]> {
        this.setAuthorizationHeader();
        this.axiosInstance.defaults.headers.get['Content-Type'] = 'application/json;charset=utf-8';
        const response = await this.axiosInstance.get<TaskProgressResponse[]>("");
        return response.data;
    }

    public async getTask<R = unknown>(taskId: string): Promise<TaskProgressResponse<R>> {
        this.setAuthorizationHeader();
        this.axiosInstance.defaults.headers.get['Content-Type'] = 'application/json;charset=utf-8';
        const response = await this.axiosInstance.get<TaskProgressResponse<R>>("/" + encodeURIComponent(taskId));
        return response.data;
    }

    /** Asks the backend to stop the task at its next checkpoint and revert its changes; answers 409 once the task has finished. */
    public async cancelTask<R = unknown>(taskId: string): Promise<TaskProgressResponse<R>> {
        this.setAuthorizationHeader();
        const response = await this.axiosInstance.post<TaskProgressResponse<R>>("/" + encodeURIComponent(taskId) + "/cancel", null);
        return response.data;
    }

    /** Removes a finished task from the list; the backend answers 409 while the task is still running. */
    public async dismissTask(taskId: string): Promise<void> {
        this.setAuthorizationHeader();
        await this.axiosInstance.delete<void>("/" + encodeURIComponent(taskId));
    }
}
