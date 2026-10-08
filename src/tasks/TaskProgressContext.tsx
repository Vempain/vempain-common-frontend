import {type ReactNode, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useSession} from "@vempain/vempain-auth-frontend";
import type {TaskAPI} from "../services";
import {isTaskFinished, type TaskAcceptedResponse, type TaskProgressResponse} from "../models";
import {readClosedTaskIds, TASK_POLL_INTERVAL_MS, writeClosedTaskIds} from "./TaskProgressConfig";
import {type TaskFinishedCallback, taskProgressContext, type TaskProgressContextValue, type TrackTaskOptions} from "./TaskProgressContextValue";

function fromAccepted(accepted: TaskAcceptedResponse): TaskProgressResponse {
    return {
        task_id: accepted.task_id,
        type: accepted.type,
        title: accepted.title,
        status: accepted.status,
        total_steps: accepted.total_steps,
        completed_steps: 0,
        failed_steps: 0,
        percent: 0,
        cancel_requested: false,
        reverted_steps: 0,
        message: null,
        error_message: null,
        result: null,
        created_at: new Date().toISOString(),
        started_at: null,
        finished_at: null,
    };
}

function sortNewestFirst(tasks: TaskProgressResponse[]): TaskProgressResponse[] {
    return [...tasks].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export interface TaskProgressProviderProps {
    /** Client of the hosting backend's task API, for example {@code new TaskAPI(apiUrl, "/tasks")}. */
    taskAPI: TaskAPI;
    children: ReactNode;
}

/**
 * Keeps the list of background tasks of the signed-in user, polls the running ones and notifies callers when a task finishes.
 * Closing a card only hides it; cancelling asks the backend to stop the task and revert its changes.
 * The provider only depends on the task API client of the host and on the task models, so any backend that hosts the
 * shared task facility (vempain-common-core) can be tracked with it.
 */
export function TaskProgressProvider({taskAPI, children}: TaskProgressProviderProps) {
    const {userSession} = useSession();
    const [tasks, setTasks] = useState<TaskProgressResponse[]>([]);
    const [closedIds, setClosedIds] = useState<Set<string>>(() => readClosedTaskIds());
    const callbacks = useRef<Map<string, TaskFinishedCallback<never>>>(new Map());
    const signedIn = Boolean(userSession);

    const upsert = useCallback((task: TaskProgressResponse) => {
        setTasks(previous => sortNewestFirst([...previous.filter(existing => existing.task_id !== task.task_id), task]));
    }, []);

    const settle = useCallback((task: TaskProgressResponse) => {
        upsert(task);
        if (isTaskFinished(task.status)) {
            const callback = callbacks.current.get(task.task_id);
            if (callback) {
                callbacks.current.delete(task.task_id);
                (callback as TaskFinishedCallback)(task);
            }
        }
    }, [upsert]);

    const refresh = useCallback(async () => {
        if (!signedIn) {
            return;
        }
        try {
            const restored = await taskAPI.getTasks();
            setTasks(sortNewestFirst(restored));
            // Drop the closed-id bookkeeping of tasks that the backend no longer lists
            setClosedIds(previous => {
                const known = new Set(restored.map(task => task.task_id));
                const next = new Set([...previous].filter(id => known.has(id)));
                if (next.size !== previous.size) {
                    writeClosedTaskIds(next);
                }
                return next;
            });
        } catch (error) {
            console.error("Failed to load background tasks", error);
        }
    }, [signedIn, taskAPI]);

    const trackTask = useCallback(<R, >(accepted: TaskAcceptedResponse, options?: TrackTaskOptions<R>) => {
        if (options?.onFinished) {
            callbacks.current.set(accepted.task_id, options.onFinished as TaskFinishedCallback<never>);
        }
        upsert(fromAccepted(accepted));
    }, [upsert]);

    const closeTask = useCallback((taskId: string) => {
        const task = tasks.find(candidate => candidate.task_id === taskId);
        setClosedIds(previous => {
            const next = new Set(previous);
            next.add(taskId);
            writeClosedTaskIds(next);
            return next;
        });
        if (task && isTaskFinished(task.status)) {
            // A finished task is gone for good; a running one must stay in the backend list
            callbacks.current.delete(taskId);
            setTasks(previous => previous.filter(candidate => candidate.task_id !== taskId));
            taskAPI.dismissTask(taskId)
                    .catch((error: unknown) => console.error("Failed to dismiss background task " + taskId, error));
        }
    }, [tasks, taskAPI]);

    const cancelTask = useCallback(async (taskId: string) => {
        const snapshot = await taskAPI.cancelTask(taskId);
        settle(snapshot);
    }, [settle, taskAPI]);

    // Restore the list after a reload or a login. The list of a previous session is replaced by the restored one and its
    // callbacks are dropped; while signed out nothing is shown or polled (see visibleTasks and the polling effect).
    useEffect(() => {
        if (!signedIn) {
            return;
        }
        let cancelled = false;
        taskAPI.getTasks()
                .then(restored => {
                    if (cancelled) {
                        return;
                    }
                    callbacks.current.clear();
                    setTasks(sortNewestFirst(restored));
                    setClosedIds(previous => {
                        const known = new Set(restored.map(task => task.task_id));
                        const next = new Set([...previous].filter(id => known.has(id)));
                        if (next.size !== previous.size) {
                            writeClosedTaskIds(next);
                        }
                        return next;
                    });
                })
                .catch((error: unknown) => console.error("Failed to load background tasks", error));
        return () => {
            cancelled = true;
        };
    }, [signedIn, taskAPI]);

    // Poll the unfinished tasks, closed cards included, so that their onFinished callbacks still fire
    const activeIds = useMemo(() => tasks.filter(task => !isTaskFinished(task.status)).map(task => task.task_id), [tasks]);
    useEffect(() => {
        if (!signedIn || activeIds.length === 0) {
            return;
        }
        let cancelled = false;
        const timer = window.setInterval(() => {
            activeIds.forEach(taskId => {
                taskAPI.getTask(taskId)
                        .then(task => {
                            if (!cancelled) {
                                settle(task);
                            }
                        })
                        .catch((error: unknown) => {
                            console.error("Failed to poll background task " + taskId, error);
                        });
            });
        }, TASK_POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [activeIds, settle, signedIn, taskAPI]);

    const visibleTasks = useMemo(() => signedIn ? tasks.filter(task => !closedIds.has(task.task_id)) : [], [tasks, closedIds, signedIn]);
    const value = useMemo<TaskProgressContextValue>(() => ({tasks: visibleTasks, trackTask, closeTask, cancelTask, refresh}),
            [visibleTasks, trackTask, closeTask, cancelTask, refresh]);

    return <taskProgressContext.Provider value={value}>{children}</taskProgressContext.Provider>;
}
