# Changelog

All notable changes to this package are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package uses [Semantic Versioning](https://semver.org/).
Entries are written by hand; `npm version` moves them from Unreleased to the released version.

## [Unreleased]

### Added

- Entry points `./tsconfig.json` and `./tsconfig.build.json`: compiler options of the mielk TypeScript standard and the build to `dist/` with declarations, with paths relative to the library (`${configDir}`) (TASK-210).
- Entry point `./eslint`: `mielkEslint({ rootDir, ignores?, allowEnv? }, ...extra)` with `recommendedTypeChecked`, the required rules as errors and the ban on `process.env` outside repository scripts (TASK-210).
- Entry point `./prettier`: the Prettier options of the standard (TASK-210).
- Entry point `./vitest`: `mielkVitest({ name, include?, coverageInclude? })` with v8 coverage, an 80% line and branch threshold and the report in the system temp folder (TASK-210).
- Command `mielk-check-package`: `publint --strict`, `attw --pack . --profile esm-only` and the check of the package file list in one command; a missing tool ends it with a one-line message and exit code 1 (TASK-210).
- Command `mielk-release-changelog`: the changelog step of `npm version`; keeps the line endings of the file (TASK-210).
- Dependency `zod`: validates the JSON read by `mielk-check-package` (TASK-210).
