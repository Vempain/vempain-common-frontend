# vempain-common-frontend — Agent Guide

## What this repo is

- `@vempain/vempain-common-frontend` is a **React/TypeScript library** (ESM, published to GitHub Packages), not an app. It holds the frontend
  half of the shared background task facility whose backend half is `vempain-common-core` (`fi.poltsi.vempain.common.task`): the task API
  client, the task models, the `TaskProgressProvider`/`useTaskProgress()` state and the `TaskProgressTray`; and the generic UI building
  blocks the Vempain SPAs share (`src/buttons/`).
- Consumers: `vempain-admin-frontend` and `vempain-file-frontend`. The published API surface is everything re-exported from `src/index.ts`
  (`models`, `services`, `tasks`); changing an export is a breaking change for the consuming SPAs, bump the version and update them in the
  same change set.
- The library must stay free of service-specific logic: task types are plain strings here, result payloads are generic (`TaskProgressResponse<R>`).
- No ACL functionality belongs here. `AclRowsEditor` (and its `AclVO` adapter `AclEditor`) live in `@vempain/vempain-auth-frontend`, which is
  the home of every shared ACL component, model and helper of the Vempain frontends; this library depends on that one (`TaskAPI extends AbstractAPI`), so the
  dependency only goes that way. Add future shared ACL functionality to the auth library and
  consume it from there; never add or duplicate it here.

## Layout

| Path             | Purpose                                                                                                                                                              |
|------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `src/models/`    | `TaskStatusEnum` (`as const` object + helpers), `responses/TaskAcceptedResponse`, `responses/TaskProgressResponse`                                                   |
| `src/services/`  | `TaskAPI` (`extends AbstractAPI` of `@vempain/vempain-auth-frontend`: `getTasks`, `getTask`, `cancelTask`, `dismissTask`)                                            |
| `src/tasks/`     | `TaskProgressContext` (provider), `TaskProgressContextValue`, `useTaskProgress`, `TaskProgressTray`, `TaskProgressConfig`                                            |
| `src/buttons/`   | `SplitActionButton` (`SplitAction`, `SplitActionButtonProps`, `SPLIT_ACTION_MENU_LABEL`)                                                                             |
| `src/map/`       | The clustered map of GPS-tagged resources: `MapView`, `MapFilters`, `MapAPI` (+ `MapViewSource`), the `models/` of `MapAPI` of `vempain-common-api`, `MapViewConfig` |
| `src/__tests__/` | Jest tests (`*.test.ts(x)`), mirroring the `src/` layout; `src/testUtils/mockAuthFrontend.ts` mocks the auth library                                                 |

## Semantics to preserve

- A host creates one `TaskAPI` per backend (`new TaskAPI(apiUrl, "/tasks")`) and passes it to `<TaskProgressProvider taskAPI={...}>`; the
  provider polls unfinished tasks every `TASK_POLL_INTERVAL_MS` and restores the user's task list after a reload (`GET /tasks`); both are
  background reads (`getTask(id, {background: true})`, `getTasks({background: true})`: the `X-Vempain-Background` header of
  `@vempain/vempain-auth-frontend`), which the backends serve without renewing the sliding session, so an open tray never keeps an idle
  session alive. The provider drops the list on
  logout (`useSession()` of the auth library).
- Closing a card (`closeTask`) only hides it: closed ids are kept in session storage, a running task keeps running and is still polled so its
  `onFinished` callback fires; a finished task is also dismissed from the backend list. Cancelling (`cancelTask`, `POST /tasks/{id}/cancel`)
  stops the task and reverts its changes; the card shows CANCELLING and then CANCELLED with the number of reverted changes.
- JSON is snake_case (`task_id`, `total_steps`, `cancel_requested`, ...), mirroring `vempain-common-api`; never rename fields to camelCase.
- The backend estimates the remaining time of a running task (`estimated_remaining_seconds`, extrapolated from the pace of the completed steps;
  null while queued, before the first completed step, while cancelling and once finished). The card turns it into a coarse text with
  `tasks/taskTimeEstimate.ts` (`remainingTimeText`: under a minute, minutes, hours) using the `TaskProgress.remaining*` keys; the estimate is
  never computed in the browser.
- `SplitActionButton` is a split button whose arrow part opens a menu of `actions` (`key`, `label`, optional `onClick`, `disabled`):
  picking one only selects it, the main part shows the selected label and runs the selected action when clicked (Ant Design's
  `Dropdown.Button` runs a menu item on pick, which is why this exists). Uncontrolled through `defaultActionKey`, controlled through
  `selectedActionKey` + `onActionSelect`; `htmlType="submit"` lets a surrounding form run its `onFinish` and read the selected key from
  the host's state; `disabled`/`loading` disable both parts. It carries no labels or logic of its own: the host (first user: the page
  editor of the admin SPA, "Save page" / "Save and publish") supplies them. Tested in `src/__tests__/buttons/SplitActionButton.test.tsx`.
- `MapView` is the map of the GPS-tagged resources of a backend, shared by the file SPA (original files) and the admin SPA (published site
  files), over the `MapAPI` of `vempain-common-api` (`POST /map/clusters`, `POST /map/files`; client `MapAPI`, or any `MapViewSource`). The
  backend clusters: the view reports the viewport and zoom after every pan or zoom (debounced `MAP_FETCH_DEBOUNCE_MS`), draws one
  `CircleMarker` per cluster sized by `clusterRadius(count)` with the count as a permanent tooltip (a single resource is a blue dot without
  one), lists the files of a cluster of at most `MAP_MAX_LISTED_FILES` on mouseover in a popup (fetched once per cell, `limit` =
  `MAP_MAX_LISTED_FILES`) and shows "too many, zoom in" with a zoom button for larger ones; clicking a cluster zooms in
  `MAP_CLUSTER_ZOOM_STEP` levels, clicking a listed file (or a single point through its popup) opens a modal with the host's
  `renderThumbnail(file)` and `renderFileDetails(file)`. The host supplies the `fileTypes` it keeps, the `tileUrl`/`attribution` of its
  tile server, an optional `searchTags` for the tag filter, and imports `leaflet/dist/leaflet.css` itself. The filters (file type, taken
  between, tags, file name) are applied by the backend (`toFilterRequest`). `leaflet` and `react-leaflet` are peer dependencies; Jest
  replaces `react-leaflet` with `src/testUtils/reactLeafletMock.tsx` (`mockMap`, `mapEventHandlers`). Texts: `MapView.*` keys with the
  defaults of `MAP_VIEW_TRANSLATION_DEFAULTS`. Tested in `src/__tests__/map/`.
- Texts go through `react-i18next` keys `TaskProgress.*` with English defaults in `TASK_PROGRESS_TRANSLATION_DEFAULTS`; hosts translate them
  in their locale files.
- Peer dependencies (React 19, antd 6, `@ant-design/icons`, axios, `react-i18next`, `@vempain/vempain-auth-frontend`, `leaflet`, `react-leaflet`)
  are provided by the host.

## Conventions

- Do not add TypeScript `enum`; use `as const` objects like the other Vempain frontends.
- Tests live in `src/__tests__/`; Jest runs with `ts-jest` under `jest-environment-jsdom` with `@testing-library/react` (`jest.config.js`,
  `tsconfig.jest.json`, setup in `src/setupTests.ts`).
- `tsconfig.build.json` excludes tests and emits `dist/` with declarations; only `dist/` is published.
- Build metadata is generated by `generateBuildInfo.js` into `src/buildInfo.json`; treat the JSON as a derived artifact.

## Tooling and validation

```bash
yarn lint
yarn test
yarn build
```

`yarn lint` is type-aware (`parserOptions.projectService`) and fails on `@typescript-eslint/no-deprecated`: any use of functionality that the type declarations
mark `@deprecated` (Ant Design props, DOM or library APIs) must be replaced by the documented successor. CI runs it before the build.

Use the checked-in Yarn 4 release (`.yarn/releases`, `yarnPath` in `.yarnrc.yml`); `@vempain/*` packages resolve from GitHub Packages with
`VEMPAIN_ACTION_TOKEN`. CI uses the reusable `frontend-library.yaml` workflow from `vempain-workflows`, which sets the package version from
`VERSION` and publishes to GitHub Packages on `main`. Release order after a contract change: `vempain-common` (backend), this library, then the
admin and file frontends. Do not commit `dist/`, `coverage/` or `node_modules/`.

## Tag ACL rule

Tags are metadata, not ACL-bearing resources. Tag entities have no ACL information, so tag list, search, and mutation endpoints must not perform ACL checks on
tags. ACL checks apply only to resources that explicitly carry an ACL.
