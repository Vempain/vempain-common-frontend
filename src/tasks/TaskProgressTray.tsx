import {Button, Card, message, Progress, Space, Typography} from "antd";
import {CheckCircleOutlined, CloseCircleOutlined, CloseOutlined, LoadingOutlined, StopOutlined} from "@ant-design/icons";
import type {CSSProperties} from "react";
import {useTranslation} from "react-i18next";
import {isTaskCancellable, isTaskFinished, type TaskProgressResponse, TaskStatusEnum} from "../models";
import {useTaskProgress} from "./useTaskProgress";

const {Text} = Typography;

const TRAY_STYLE: CSSProperties = {
    position: "fixed",
    right: 16,
    bottom: 16,
    width: 360,
    maxWidth: "calc(100vw - 32px)",
    maxHeight: "60vh",
    overflowY: "auto",
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    pointerEvents: "none",
};

/**
 * Translation keys used by the tray with their English defaults. A host adds the `TaskProgress` keys to its locale files to
 * translate them; without them the defaults are shown.
 */
export const TASK_PROGRESS_TRANSLATION_DEFAULTS = {
    "TaskProgress.title": "Background tasks",
    "TaskProgress.queued": "Queued",
    "TaskProgress.running": "Running",
    "TaskProgress.cancelling": "Cancelling, reverting changes",
    "TaskProgress.cancelled": "Cancelled, changes reverted",
    "TaskProgress.completed": "Completed",
    "TaskProgress.failed": "Failed",
    "TaskProgress.steps": "{{completed}} / {{total}} steps",
    "TaskProgress.failedSteps": "{{count}} failed",
    "TaskProgress.revertedSteps": "{{count}} reverted",
    "TaskProgress.close": "Close",
    "TaskProgress.cancel": "Cancel",
    "TaskProgress.cancelError": "Failed to cancel the task",
} as const;

type TaskProgressTranslationKey = keyof typeof TASK_PROGRESS_TRANSLATION_DEFAULTS;

function statusKey(status: TaskStatusEnum): TaskProgressTranslationKey {
    switch (status) {
        case TaskStatusEnum.QUEUED:
            return "TaskProgress.queued";
        case TaskStatusEnum.RUNNING:
            return "TaskProgress.running";
        case TaskStatusEnum.CANCELLING:
            return "TaskProgress.cancelling";
        case TaskStatusEnum.CANCELLED:
            return "TaskProgress.cancelled";
        case TaskStatusEnum.COMPLETED:
            return "TaskProgress.completed";
        default:
            return "TaskProgress.failed";
    }
}

/** Translates a tray key, falling back to its English default when the host has no translation for it. */
function useTrayTranslation() {
    const {t} = useTranslation();
    return (key: TaskProgressTranslationKey, options?: Record<string, unknown>) =>
            t(key, {defaultValue: TASK_PROGRESS_TRANSLATION_DEFAULTS[key], ...options});
}

function StatusIcon({status}: { status: TaskStatusEnum }) {
    if (status === TaskStatusEnum.COMPLETED) {
        return <CheckCircleOutlined style={{color: "#52c41a"}} aria-label="completed"/>;
    }
    if (status === TaskStatusEnum.FAILED) {
        return <CloseCircleOutlined style={{color: "#ff4d4f"}} aria-label="failed"/>;
    }
    if (status === TaskStatusEnum.CANCELLED) {
        return <StopOutlined style={{color: "#faad14"}} aria-label="cancelled"/>;
    }
    return <LoadingOutlined aria-label="running"/>;
}

export interface TaskProgressCardProps {
    task: TaskProgressResponse;
    /** Closes the card; never touches the running task. */
    onClose: (taskId: string) => void;
    /** Stops the task in the backend and reverts its changes. */
    onCancel: (taskId: string) => void;
}

export function TaskProgressCard({task, onClose, onCancel}: TaskProgressCardProps) {
    const t = useTrayTranslation();
    const finished = isTaskFinished(task.status);
    const failed = task.status === TaskStatusEnum.FAILED;
    const cancelled = task.status === TaskStatusEnum.CANCELLED;
    const cancellable = isTaskCancellable(task.status) && !task.cancel_requested;

    return (
            <Card
                    size="small"
                    data-testid={`task-card-${task.task_id}`}
                    data-status={task.status}
                    style={{pointerEvents: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.45)"}}
                    title={<Space size="small"><StatusIcon status={task.status}/><Text ellipsis={{tooltip: task.title}}
                                                                                       style={{maxWidth: 240}}>{task.title}</Text></Space>}
                    extra={(
                            <Button
                                    type="text"
                                    size="small"
                                    icon={<CloseOutlined/>}
                                    aria-label={t("TaskProgress.close")}
                                    title={t("TaskProgress.close")}
                                    onClick={() => onClose(task.task_id)}
                            />
                    )}
            >
                <Space orientation="vertical" size={2} style={{width: "100%"}}>
                    <Progress
                            percent={task.percent}
                            size="small"
                            status={failed ? "exception" : cancelled ? "normal" : finished ? "success" : "active"}
                    />
                    <Text type={failed ? "danger" : cancelled ? "warning" : "secondary"} style={{fontSize: 12}}>
                        {t(statusKey(task.status))}
                        {task.total_steps > 0 && ` · ${t("TaskProgress.steps", {completed: task.completed_steps, total: task.total_steps})}`}
                        {task.failed_steps > 0 && ` · ${t("TaskProgress.failedSteps", {count: task.failed_steps})}`}
                        {task.reverted_steps > 0 && ` · ${t("TaskProgress.revertedSteps", {count: task.reverted_steps})}`}
                    </Text>
                    {(failed ? task.error_message : task.message) && (
                            <Text type={failed ? "danger" : undefined} ellipsis={{tooltip: failed ? task.error_message : task.message}} style={{fontSize: 12}}>
                                {failed ? task.error_message : task.message}
                            </Text>
                    )}
                    {!finished && (
                            <Button
                                    danger
                                    size="small"
                                    icon={<StopOutlined/>}
                                    disabled={!cancellable}
                                    loading={task.cancel_requested && !finished}
                                    onClick={() => onCancel(task.task_id)}
                                    style={{alignSelf: "flex-end"}}
                            >
                                {t("TaskProgress.cancel")}
                            </Button>
                    )}
                </Space>
            </Card>
    );
}

/**
 * Non-blocking stack of task cards in the lower right corner. The X of a card only closes that card; the task itself keeps
 * running. A running task can be stopped with its Cancel button, which also reverts the changes it has made. A finished task
 * stays visible with its completion, cancellation or failure message until the user closes it.
 */
export function TaskProgressTray() {
    const t = useTrayTranslation();
    const {tasks, closeTask, cancelTask} = useTaskProgress();

    if (tasks.length === 0) {
        return null;
    }

    const handleCancel = (taskId: string) => {
        cancelTask(taskId)
                .catch(() => {
                    message.error(t("TaskProgress.cancelError"));
                });
    };

    return (
            <div style={TRAY_STYLE} role="region" aria-label={t("TaskProgress.title")} data-testid="task-progress-tray">
                {tasks.map(task => (
                        <TaskProgressCard key={task.task_id} task={task} onClose={closeTask} onCancel={handleCancel}/>
                ))}
            </div>
    );
}
