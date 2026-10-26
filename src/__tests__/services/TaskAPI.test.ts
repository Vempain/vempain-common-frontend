import type {TaskProgressResponse} from "../../models";
import {TaskStatusEnum} from "../../models";
import {axiosMock, constructorSpy, resetServiceMockState, setAuthorizationHeaderSpy} from "../../testUtils/mockAuthFrontend";
import {TaskAPI} from "../../services";

describe("TaskAPI", () => {
    let taskAPI: TaskAPI;

    const task: TaskProgressResponse = {
        task_id: "abc",
        type: "SCAN_DIRECTORIES",
        title: "Scan /photos",
        status: TaskStatusEnum.RUNNING,
        total_steps: 4,
        completed_steps: 2,
        failed_steps: 0,
        percent: 50,
        estimated_remaining_seconds: null,
        cancel_requested: false,
        reverted_steps: 0,
        message: "Scanned 2024",
        error_message: null,
        result: null,
        created_at: "2026-10-06T10:00:00Z",
        started_at: "2026-10-06T10:00:01Z",
        finished_at: null,
    };

    beforeEach(() => {
        resetServiceMockState();
        taskAPI = new TaskAPI("http://localhost:8080/api", "/tasks");
    });

    it("is instantiated with /tasks member path", () => {
        expect(constructorSpy).toHaveBeenCalledWith(expect.anything(), "/tasks");
    });

    it("getTasks GETs the task list", async () => {
        axiosMock.get.mockResolvedValueOnce({data: [task]});

        const response = await taskAPI.getTasks();

        expect(setAuthorizationHeaderSpy).toHaveBeenCalledTimes(1);
        expect(axiosMock.get).toHaveBeenCalledWith("");
        expect(response).toEqual([task]);
    });

    it("marks background reads with the header so the backend does not renew the session", async () => {
        axiosMock.get.mockResolvedValueOnce({data: [task]});
        axiosMock.get.mockResolvedValueOnce({data: task});

        await taskAPI.getTasks({background: true});
        await taskAPI.getTask("abc", {background: true});

        expect(axiosMock.get).toHaveBeenNthCalledWith(1, "", {headers: {"X-Vempain-Background": "true"}});
        expect(axiosMock.get).toHaveBeenNthCalledWith(2, "/abc", {headers: {"X-Vempain-Background": "true"}});

        // A read the user triggered carries no such header
        axiosMock.get.mockResolvedValueOnce({data: task});
        await taskAPI.getTask("abc", {background: false});
        expect(axiosMock.get).toHaveBeenNthCalledWith(3, "/abc");
    });

    it("getTask GETs one task by its encoded id", async () => {
        axiosMock.get.mockResolvedValueOnce({data: task});

        const response = await taskAPI.getTask("a b");

        expect(axiosMock.get).toHaveBeenCalledWith("/a%20b");
        expect(response).toEqual(task);
    });

    it("cancelTask POSTs /{id}/cancel and returns the snapshot", async () => {
        const cancelling = {...task, status: TaskStatusEnum.CANCELLING, cancel_requested: true};
        axiosMock.post.mockResolvedValueOnce({data: cancelling});

        const response = await taskAPI.cancelTask("abc");

        expect(setAuthorizationHeaderSpy).toHaveBeenCalledTimes(1);
        expect(axiosMock.post).toHaveBeenCalledWith("/abc/cancel", null);
        expect(response).toEqual(cancelling);
    });

    it("dismissTask DELETEs the task", async () => {
        axiosMock.delete.mockResolvedValueOnce({data: undefined});

        await taskAPI.dismissTask("abc");

        expect(setAuthorizationHeaderSpy).toHaveBeenCalledTimes(1);
        expect(axiosMock.delete).toHaveBeenCalledWith("/abc");
    });
});
