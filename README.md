# Vempain Common frontend component

This component is part of the [Vempain](https://vempain.poltsi.fi/) project. It publishes the React components that more than one Vempain
frontend needs; today that is the background task progress tracking used by the admin and file frontends.

[AGENTS.md](AGENTS.md) has more detailed orientation and workflow guidance for agents working in this codebase.

## Contents

| Export                                                           | Purpose                                                                                                    |
|------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| `TaskAPI`                                                        | Axios client of the `/tasks` progress API hosted by every backend that runs background tasks               |
| `TaskProgressProvider`, `useTaskProgress()`                      | Tracks accepted tasks, polls them and fires `onFinished` callbacks; `trackTask`, `closeTask`, `cancelTask` |
| `TaskProgressTray`, `TaskProgressCard`                           | Non-blocking stack of task cards in the lower right corner (X closes the card, Cancel stops the task)      |
| `SplitActionButton`                                              | Split button: the arrow part picks one of several actions, the main part shows it and runs it when clicked |
| `TaskStatusEnum`, `TaskAcceptedResponse`, `TaskProgressResponse` | Models mirroring `vempain-common-api`                                                                      |

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

## Map of GPS-tagged resources

`MapView` renders the clustered map a backend answers through the `MapAPI` of `vempain-common-api` (`POST /map/clusters`, `POST /map/files`):
the backend groups the resources of the visible viewport by their coordinates rounded to the precision of the zoom level, the view draws
one marker per cluster with its count, lists the files of small clusters on mouseover, zooms in on larger ones and opens the host's details
and thumbnail of a clicked resource. The host passes its `MapAPI` instance (`new MapAPI(apiUrl, "/map")`), the file types it keeps, the tile
server and, optionally, a tag search; it also imports `leaflet/dist/leaflet.css`. `leaflet` and `react-leaflet` are peer dependencies.
