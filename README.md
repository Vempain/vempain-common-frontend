# Vempain Common frontend component

This component is part of the [Vempain](https://vempain.poltsi.fi/) project. It publishes the React components that more than one Vempain
frontend needs; today that is the background task progress tracking used by the admin and file frontends.

[AGENTS.md](AGENTS.md) has more detailed orientation and workflow guidance for agents working in this codebase.

## Contents

| Export                                                   | Purpose                                                                                          |
|----------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| `TaskAPI`                                                | Axios client of the `/tasks` progress API hosted by every backend that runs background tasks     |
| `TaskProgressProvider`, `useTaskProgress()`              | Tracks accepted tasks, polls them and fires `onFinished` callbacks; `trackTask`, `closeTask`, `cancelTask` |
| `TaskProgressTray`, `TaskProgressCard`                   | Non-blocking stack of task cards in the lower right corner (X closes the card, Cancel stops the task) |
| `TaskStatusEnum`, `TaskAcceptedResponse`, `TaskProgressResponse` | Models mirroring `vempain-common-api`                                                    |

## Usage

```tsx
import {TaskAPI, TaskProgressProvider, TaskProgressTray, useTaskProgress} from "@vempain/vempain-common-frontend";

export const taskAPI = new TaskAPI(import.meta.env.VITE_APP_API_URL, "/tasks");

<TaskProgressProvider taskAPI={taskAPI}>
    <App/>
    <TaskProgressTray/>
</TaskProgressProvider>

// in a component
const {trackTask} = useTaskProgress();
const accepted = await galleryAPI.publish(request);   // HTTP 202 with a TaskAcceptedResponse
trackTask(accepted, {onFinished: () => reload()});
```

The tray reads its texts through `react-i18next` under the `TaskProgress` keys and falls back to English (`TASK_PROGRESS_TRANSLATION_DEFAULTS`)
when the host has no translation for them.

## Build

```bash
yarn install
yarn lint
yarn test
yarn build
```

Publishing to GitHub Packages is done by CI from `main`; the version is derived from `VERSION` and the existing Git tags.
