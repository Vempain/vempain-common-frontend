---
name: change-task-tray
description: Change the shared background task UI of vempain-common-frontend (TaskAPI, TaskProgressProvider, useTaskProgress, TaskProgressTray, task models) while keeping the backend contract and the host semantics. Use for any task tray or polling change.
---

# The task tray in vempain-common-frontend

- Layout: `src/models/` (`TaskStatusEnum` as const + `isTaskFinished`/`isTaskCancellable`, `TaskAcceptedResponse`, `TaskProgressResponse<R>`),
  `src/services/TaskAPI` (`extends AbstractAPI` of the auth library: `getTasks`, `getTask`, `cancelTask`, `dismissTask`),
  `src/tasks/` (`TaskProgressContext` provider, `useTaskProgress`, `TaskProgressTray`, `TaskProgressConfig`).
- Semantics to preserve: a host creates one `TaskAPI` per backend and mounts `<TaskProgressProvider taskAPI={...}>` plus
  `<TaskProgressTray/>`; the provider polls unfinished tasks every `TASK_POLL_INTERVAL_MS`, restores the list after a reload (`GET /tasks`)
  and drops it on logout; `trackTask(accepted, {onFinished})` registers a callback that fires even for a closed card; `closeTask` hides
  only (ids in session storage, finished tasks also dismissed on the backend); `cancelTask` posts `/tasks/{id}/cancel` and the card shows
  CANCELLING then CANCELLED with reverted steps.
- The library is service agnostic: task types are strings, results generic; never add admin or file specific logic.
- JSON mirrors `vempain-common-api` (`task_id`, `total_steps`, `completed_steps`, `failed_steps`, `reverted_steps`, `cancel_requested`,
  `percent`, `message`, `error_message`, `result`); a backend contract change lands in `vempain-common` first.
- Texts are `react-i18next` keys `TaskProgress.*` with defaults in `TASK_PROGRESS_TRANSLATION_DEFAULTS`; hosts translate them in their
  locale files, so a new key needs entries in the admin and file frontends.
- Tests in `src/__tests__/` (jsdom, testing-library, `src/testUtils/mockAuthFrontend.ts`); no TypeScript `enum`. Run `yarn lint`,
  `yarn test`, `yarn build`.
