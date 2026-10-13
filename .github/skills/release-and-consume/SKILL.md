---
name: release-and-consume
description: Release vempain-common-frontend to GitHub Packages and update the admin and file frontends in the mandated order. Use whenever an export or the task contract changes.
---

# Release vempain-common-frontend and consume it

- The published surface is everything re-exported from `src/index.ts` (`models`, `services`, `tasks`); consumers are
  `vempain-admin-frontend` and `vempain-file-frontend`. An export change is breaking: bump `VERSION` and update both consumers in the same
  change set.
- Release order after a task contract change: `vempain-common` (backend), this library, then the admin and file frontends.
- CI (`frontend-library.yaml` of `vempain-workflows`) sets the package version from `VERSION` and publishes to GitHub Packages on `main`;
  only `dist/` is published (`tsconfig.build.json`). Peer dependencies (React 19, antd 6, `@ant-design/icons`, axios, `react-i18next`,
  `@vempain/vempain-auth-frontend`) stay peers.
- Consumers install with the checked-in Yarn 4 and `VEMPAIN_ACTION_TOKEN`; bump the dependency range in their `package.json` and run their
  `yarn lint`, `yarn test`, `yarn build`.
- Validate here first: `yarn lint`, `yarn test`, `yarn build`; `src/buildInfo.json` is a derived artifact.
