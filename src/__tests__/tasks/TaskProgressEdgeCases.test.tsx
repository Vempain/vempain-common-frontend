import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {message} from "antd";
import type {ReactNode} from "react";
import type {TaskAPI} from "../../services";
import type {TaskProgressResponse} from "../../models";
import {TaskStatusEnum} from "../../models";
import * as library from "../../index";
import {
    CLOSED_TASKS_STORAGE_KEY,
    TASK_POLL_INTERVAL_MS,
    TASK_PROGRESS_TRANSLATION_DEFAULTS,
    TaskProgressCard,
    TaskProgressProvider,
    TaskProgressTray,
    useTaskProgress
} from "../../tasks";
import {readClosedTaskIds, writeClosedTaskIds} from "../../tasks/TaskProgressConfig";

jest.mock("react-i18next", () => ({
    useTranslation: () => ({t: (key: string) => key}),
}));

const sessionState: { userSession: { token: string } | null } = {userSession: {token: "token"}};
jest.mock("@vempain/vempain-auth-frontend", () => ({
    useSession: () => sessionState,
    // The root barrel re-exports TaskAPI, which extends the auth library's base client
    AbstractAPI: class {
        protected setAuthorizationHeader(): void {
            // no-op for the barrel test
        }
    },
}), {virtual: true});

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

function task(overrides: Partial<TaskProgressResponse>): TaskProgressResponse {
    return {
        task_id: "task-1",
        type: "SCAN_DIRECTORIES",
        title: "Scan",
        status: TaskStatusEnum.RUNNING,
        total_steps: 2,
        completed_steps: 1,
        failed_steps: 0,
        percent: 50,
        cancel_requested: false,
        reverted_steps: 0,
        message: null,
        error_message: null,
        result: null,
        created_at: "2026-10-06T10:00:00Z",
        started_at: null,
        finished_at: null,
        ...overrides,
    };
}

function Refresher() {
    const {refresh, tasks} = useTaskProgress();
    return <>
        <button onClick={() => void refresh()}>refresh</button>
        <ul>{tasks.map(current => <li key={current.task_id}>{current.task_id}</li>)}</ul>
    </>;
}

describe("TaskProgressProvider edge cases", () => {
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
        jest.useFakeTimers();
        getTasks.mockReset();
        getTask.mockReset();
        cancelTask.mockReset();
        dismissTask.mockReset();
        sessionState.userSession = {token: "token"};
        window.sessionStorage.clear();
        consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleError.mockRestore();
        jest.useRealTimers();
    });

    it("refresh reloads the list newest first and forgets closed ids the backend no longer lists", async () => {
        window.sessionStorage.setItem(CLOSED_TASKS_STORAGE_KEY, JSON.stringify(["gone", "task-old"]));
        getTasks.mockResolvedValueOnce([
            task({task_id: "gone", created_at: "2026-09-30T00:00:00Z"}),
            task({task_id: "task-old", created_at: "2026-10-01T00:00:00Z"}),
        ]);
        render(<Provider><Refresher/></Provider>);
        await act(async () => undefined);
        expect(screen.queryByText("gone")).toBeNull();

        getTasks.mockResolvedValueOnce([
            task({task_id: "task-old", created_at: "2026-10-01T00:00:00Z"}),
            task({task_id: "task-new", created_at: "2026-10-02T00:00:00Z"}),
        ]);
        fireEvent.click(screen.getByText("refresh"));
        await act(async () => undefined);

        // task-old stays closed (hidden), task-new is visible, and the stale id "gone" was pruned from the storage
        expect(screen.queryByText("task-old")).toBeNull();
        expect(screen.getByText("task-new")).toBeInTheDocument();
        expect(JSON.parse(window.sessionStorage.getItem(CLOSED_TASKS_STORAGE_KEY) ?? "[]")).toEqual(["task-old"]);
    });

    it("refresh logs a failed reload and does nothing while signed out", async () => {
        getTasks.mockResolvedValueOnce([]);
        const view = render(<Provider><Refresher/></Provider>);
        await act(async () => undefined);

        getTasks.mockRejectedValueOnce(new Error("offline"));
        fireEvent.click(screen.getByText("refresh"));
        await act(async () => undefined);
        await waitFor(() => expect(consoleError).toHaveBeenCalledWith("Failed to load background tasks", expect.any(Error)));

        sessionState.userSession = null;
        view.rerender(<Provider><Refresher/></Provider>);
        getTasks.mockClear();
        fireEvent.click(screen.getByText("refresh"));
        await act(async () => undefined);
        expect(getTasks).not.toHaveBeenCalled();
    });

    it("mount restore prunes closed ids and logs a failed restore", async () => {
        window.sessionStorage.setItem(CLOSED_TASKS_STORAGE_KEY, JSON.stringify(["vanished"]));
        getTasks.mockResolvedValueOnce([task({task_id: "task-1"})]);
        const first = render(<Provider><Refresher/></Provider>);
        await act(async () => undefined);
        expect(JSON.parse(window.sessionStorage.getItem(CLOSED_TASKS_STORAGE_KEY) ?? "[]")).toEqual([]);
        first.unmount();

        getTasks.mockRejectedValueOnce(new Error("boom"));
        render(<Provider><Refresher/></Provider>);
        await act(async () => undefined);
        expect(consoleError).toHaveBeenCalledWith("Failed to load background tasks", expect.any(Error));
    });

    it("logs a failed dismiss and a failed poll without breaking the tray", async () => {
        getTasks.mockResolvedValueOnce([task({task_id: "done", status: TaskStatusEnum.COMPLETED, percent: 100}), task({task_id: "running"})]);
        dismissTask.mockRejectedValueOnce(new Error("dismiss failed"));
        getTask.mockRejectedValue(new Error("poll failed"));
        render(<Provider><TaskProgressTray/></Provider>);
        await act(async () => undefined);

        fireEvent.click(screen.getAllByLabelText("TaskProgress.close")[0]);
        await act(async () => undefined);
        expect(dismissTask).toHaveBeenCalledWith("done");
        await waitFor(() => expect(consoleError).toHaveBeenCalledWith("Failed to dismiss background task done", expect.any(Error)));

        await act(async () => {
            jest.advanceTimersByTime(TASK_POLL_INTERVAL_MS + 10);
        });
        await waitFor(() => expect(consoleError).toHaveBeenCalledWith("Failed to poll background task running", expect.any(Error)));
    });

    it("shows an error message when the cancel request fails", async () => {
        const errorMessage = jest.spyOn(message, "error").mockImplementation(() => ({}) as never);
        getTasks.mockResolvedValueOnce([task({task_id: "running"})]);
        cancelTask.mockRejectedValueOnce(new Error("cannot cancel"));
        render(<Provider><TaskProgressTray/></Provider>);
        await act(async () => undefined);

        fireEvent.click(screen.getByText("TaskProgress.cancel"));
        await waitFor(() => expect(errorMessage).toHaveBeenCalledWith("TaskProgress.cancelError"));
        errorMessage.mockRestore();
    });
});

describe("useTaskProgress", () => {
    it("throws outside the provider", () => {
        function Orphan() {
            useTaskProgress();
            return null;
        }

        const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
        expect(() => render(<Orphan/>)).toThrow("useTaskProgress must be used inside a TaskProgressProvider");
        consoleError.mockRestore();
    });
});

describe("closed task storage", () => {
    it("falls back to an empty set when the storage is unreadable and swallows write failures", () => {
        const getItem = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        expect(readClosedTaskIds().size).toBe(0);
        getItem.mockRestore();

        window.sessionStorage.setItem(CLOSED_TASKS_STORAGE_KEY, "not json");
        expect(readClosedTaskIds().size).toBe(0);

        const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        expect(() => writeClosedTaskIds(new Set(["a"]))).not.toThrow();
        setItem.mockRestore();
    });
});

describe("library entry point", () => {
    it("re-exports the models, the service and the task components", () => {
        expect(typeof library.TaskAPI).toBe("function");
        expect(typeof library.TaskProgressProvider).toBe("function");
        expect(typeof library.TaskProgressTray).toBe("function");
        expect(typeof library.useTaskProgress).toBe("function");
        expect(library.TaskStatusEnum.COMPLETED).toBe("COMPLETED");
        expect(typeof TaskProgressCard).toBe("function");
        expect(TASK_PROGRESS_TRANSLATION_DEFAULTS["TaskProgress.title"]).toBeDefined();
    });
});
