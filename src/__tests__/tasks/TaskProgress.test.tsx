import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import type {ReactNode} from "react";
import type {TaskAPI} from "../../services";
import type {TaskAcceptedResponse, TaskProgressResponse} from "../../models";
import {TaskStatusEnum} from "../../models";
import {CLOSED_TASKS_STORAGE_KEY, TASK_POLL_INTERVAL_MS, TaskProgressProvider, TaskProgressTray, useTaskProgress} from "../../tasks";

jest.mock("react-i18next", () => ({
    useTranslation: () => ({
        // Echo the key (plus any interpolation values) so that assertions do not depend on the English defaults
        t: (key: string, options?: Record<string, unknown>) => {
            const values = Object.fromEntries(Object.entries(options ?? {}).filter(([name]) => name !== "defaultValue"));
            return Object.keys(values).length > 0 ? `${key} ${JSON.stringify(values)}` : key;
        },
    }),
}));

const sessionState: { userSession: { token: string } | null } = {userSession: {token: "token"}};
jest.mock("@vempain/vempain-auth-frontend", () => ({
    useSession: () => sessionState,
}), {virtual: true});

// The provider receives the task API client of the host; a plain object with mocked methods stands in for it
const taskAPI = {
    getTasks: jest.fn(),
    getTask: jest.fn(),
    cancelTask: jest.fn(),
    dismissTask: jest.fn(),
} as unknown as TaskAPI;

const getTasks = jest.mocked(taskAPI.getTasks);
const getTask = jest.mocked(taskAPI.getTask);
const cancelTask = jest.mocked(taskAPI.cancelTask);
const dismissTask = jest.mocked(taskAPI.dismissTask);

function Provider({children}: { children: ReactNode }) {
    return <TaskProgressProvider taskAPI={taskAPI}>{children}</TaskProgressProvider>;
}

const accepted: TaskAcceptedResponse = {
    task_id: "task-1",
    type: "SCAN_DIRECTORIES",
    title: "Scan /photos",
    status: TaskStatusEnum.QUEUED,
    total_steps: 2,
};

function snapshot(overrides: Partial<TaskProgressResponse>): TaskProgressResponse {
    return {
        task_id: "task-1",
        type: "SCAN_DIRECTORIES",
        title: "Scan /photos",
        status: TaskStatusEnum.RUNNING,
        total_steps: 2,
        completed_steps: 1,
        failed_steps: 0,
        percent: 50,
        cancel_requested: false,
        reverted_steps: 0,
        message: "Scanned 2024",
        error_message: null,
        result: null,
        created_at: "2026-10-06T10:00:00Z",
        started_at: "2026-10-06T10:00:01Z",
        finished_at: null,
        ...overrides,
    };
}

function Starter({onFinished}: { onFinished: (task: TaskProgressResponse<{ scanned: number }>) => void }) {
    const {trackTask} = useTaskProgress();
    return <button onClick={() => trackTask<{ scanned: number }>(accepted, {onFinished})}>start</button>;
}

describe("TaskProgressProvider and TaskProgressTray", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        getTasks.mockReset();
        getTask.mockReset();
        cancelTask.mockReset();
        dismissTask.mockReset();
        window.sessionStorage.clear();
        getTasks.mockResolvedValue([]);
        sessionState.userSession = {token: "token"};
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("renders nothing while there are no tasks and restores the backend list on mount", async () => {
        getTasks.mockResolvedValueOnce([snapshot({task_id: "restored", title: "Restored task"})]);

        render(<Provider><TaskProgressTray/></Provider>);

        await waitFor(() => expect(screen.getByText("Restored task")).toBeTruthy());
        expect(getTasks).toHaveBeenCalledTimes(1);
    });

    it("tracks an accepted task, polls it to completion, keeps the card and closes it on demand", async () => {
        const onFinished = jest.fn();
        getTask.mockResolvedValueOnce(snapshot({}));
        getTask.mockResolvedValueOnce(snapshot({
            status: TaskStatusEnum.COMPLETED,
            completed_steps: 2,
            percent: 100,
            message: "Scanned 2025",
            result: {scanned: 7},
            finished_at: "2026-10-06T10:00:05Z",
        }));
        dismissTask.mockResolvedValue(undefined);

        render(
                <Provider>
                    <Starter onFinished={onFinished}/>
                    <TaskProgressTray/>
                </Provider>
        );
        await act(async () => {
            await Promise.resolve();
        });

        fireEvent.click(screen.getByText("start"));
        const card = screen.getByTestId("task-card-task-1");
        expect(card.getAttribute("data-status")).toBe(TaskStatusEnum.QUEUED);
        expect(screen.getByText("Scan /photos")).toBeTruthy();
        // A running card can be closed (X) and cancelled; the X never touches the backend
        expect(screen.getByLabelText("TaskProgress.close")).toBeTruthy();
        expect(screen.getByText("TaskProgress.cancel")).toBeTruthy();

        await act(async () => {
            jest.advanceTimersByTime(TASK_POLL_INTERVAL_MS);
            await Promise.resolve();
        });
        expect(getTask).toHaveBeenCalledWith("task-1");
        await waitFor(() => expect(screen.getByTestId("task-card-task-1").getAttribute("data-status")).toBe(TaskStatusEnum.RUNNING));
        expect(onFinished).not.toHaveBeenCalled();

        await act(async () => {
            jest.advanceTimersByTime(TASK_POLL_INTERVAL_MS);
            await Promise.resolve();
        });
        await waitFor(() => expect(screen.getByTestId("task-card-task-1").getAttribute("data-status")).toBe(TaskStatusEnum.COMPLETED));
        expect(onFinished).toHaveBeenCalledTimes(1);
        expect(onFinished.mock.calls[0][0].result).toEqual({scanned: 7});
        expect(screen.getByText("TaskProgress.completed", {exact: false})).toBeTruthy();

        // Finished tasks are not polled any more but stay visible until closed
        await act(async () => {
            jest.advanceTimersByTime(TASK_POLL_INTERVAL_MS * 2);
            await Promise.resolve();
        });
        expect(getTask).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId("task-card-task-1")).toBeTruthy();
        expect(screen.queryByText("TaskProgress.cancel")).toBeNull();

        fireEvent.click(screen.getByLabelText("TaskProgress.close"));
        await waitFor(() => expect(screen.queryByTestId("task-card-task-1")).toBeNull());
        expect(dismissTask).toHaveBeenCalledWith("task-1");
    });

    it("closing a running card hides it without touching the task, and its callback still fires", async () => {
        const onFinished = jest.fn();
        getTask.mockResolvedValueOnce(snapshot({status: TaskStatusEnum.COMPLETED, percent: 100, result: {scanned: 1}}));

        render(
                <Provider>
                    <Starter onFinished={onFinished}/>
                    <TaskProgressTray/>
                </Provider>
        );
        await act(async () => {
            await Promise.resolve();
        });
        fireEvent.click(screen.getByText("start"));
        fireEvent.click(screen.getByLabelText("TaskProgress.close"));

        expect(screen.queryByTestId("task-card-task-1")).toBeNull();
        expect(dismissTask).not.toHaveBeenCalled();
        expect(cancelTask).not.toHaveBeenCalled();
        expect(JSON.parse(window.sessionStorage.getItem(CLOSED_TASKS_STORAGE_KEY) ?? "[]")).toEqual(["task-1"]);

        await act(async () => {
            jest.advanceTimersByTime(TASK_POLL_INTERVAL_MS);
            await Promise.resolve();
        });
        await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
        expect(screen.queryByTestId("task-card-task-1")).toBeNull();
    });

    it("cancel asks the backend to stop and shows the cancelling and cancelled states", async () => {
        cancelTask.mockResolvedValueOnce(snapshot({status: TaskStatusEnum.CANCELLING, cancel_requested: true}));
        getTask.mockResolvedValueOnce(snapshot({
            status: TaskStatusEnum.CANCELLED,
            cancel_requested: true,
            reverted_steps: 1,
            percent: 100,
            message: "Cancelled, reverted 1 change",
        }));

        render(
                <Provider>
                    <Starter onFinished={() => undefined}/>
                    <TaskProgressTray/>
                </Provider>
        );
        await act(async () => {
            await Promise.resolve();
        });
        fireEvent.click(screen.getByText("start"));
        fireEvent.click(screen.getByText("TaskProgress.cancel"));

        await waitFor(() => expect(cancelTask).toHaveBeenCalledWith("task-1"));
        await waitFor(() => expect(screen.getByTestId("task-card-task-1").getAttribute("data-status")).toBe(TaskStatusEnum.CANCELLING));
        expect(screen.getByText("TaskProgress.cancelling", {exact: false})).toBeTruthy();

        await act(async () => {
            jest.advanceTimersByTime(TASK_POLL_INTERVAL_MS);
            await Promise.resolve();
        });
        await waitFor(() => expect(screen.getByTestId("task-card-task-1").getAttribute("data-status")).toBe(TaskStatusEnum.CANCELLED));
        expect(screen.getByText("TaskProgress.cancelled", {exact: false})).toBeTruthy();
        expect(screen.getByText("Cancelled, reverted 1 change")).toBeTruthy();
        expect(screen.queryByText("TaskProgress.cancel")).toBeNull();
        expect(screen.getByLabelText("TaskProgress.close")).toBeTruthy();
    });

    it("shows the error of a failed task", async () => {
        getTask.mockResolvedValueOnce(snapshot({status: TaskStatusEnum.FAILED, error_message: "Admin backend down", percent: 100}));

        render(
                <Provider>
                    <Starter onFinished={() => undefined}/>
                    <TaskProgressTray/>
                </Provider>
        );
        await act(async () => {
            await Promise.resolve();
        });
        fireEvent.click(screen.getByText("start"));
        await act(async () => {
            jest.advanceTimersByTime(TASK_POLL_INTERVAL_MS);
            await Promise.resolve();
        });

        await waitFor(() => expect(screen.getByText("Admin backend down")).toBeTruthy());
        expect(screen.getByTestId("task-card-task-1").getAttribute("data-status")).toBe(TaskStatusEnum.FAILED);
        expect(screen.getByLabelText("TaskProgress.close")).toBeTruthy();
    });

    it("does not call the backend without a session", async () => {
        sessionState.userSession = null;

        render(<Provider><TaskProgressTray/></Provider>);
        await act(async () => {
            await Promise.resolve();
        });

        expect(getTasks).not.toHaveBeenCalled();
    });
});
