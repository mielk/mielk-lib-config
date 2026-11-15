# @mielk/lib-config

Shared tool configuration of the mielk npm libraries (`@mielk/*`): the TypeScript compiler options, ESLint, Prettier
and Vitest configurations required by the mielk TypeScript and npm library standards, and two commands used by every
library: `mielk-check-package` (package check before publication) and `mielk-release-changelog` (changelog step of
`npm version`). A library imports the configuration instead of keeping its own copy, so a change of the standard
reaches all libraries through a new version of this package.

Files that must stay in the repository of each library (`.gitattributes`, `.nvmrc`, `.gitignore`, `.prettierignore`,
`.github/workflows/ci.yml`) are not part of this package. They are kept as templates in the private repository
`mielk-npm-tools`, whose command `mielk-lib sync` applies them together with this package.

## Requirements

- Node.js 24 or later (`engines.node: >=24`); development uses the version in `.nvmrc` (24.13.0).
- TypeScript 5.5 or later: the build configuration uses `${configDir}`, so paths are relative to the library and
  not to this package.
- Peer dependencies, installed by the library in `devDependencies` with exact versions (`ts:DEP-1`, `npm:ZAL-2`).
  npm links only the commands of direct dependencies to `node_modules/.bin`, so the scripts of the library
  (`eslint .`, `prettier --check .`, `vitest`, `tsc`) need them installed by the library itself:

    | Peer dependency         | Range   | Needed by                                                                   |
    | ----------------------- | ------- | --------------------------------------------------------------------------- |
    | `typescript`            | `^5.5`  | `./tsconfig.json`, `./tsconfig.build.json`; scripts `typecheck` and `build` |
    | `@types/node`           | `^24`   | `./tsconfig.json` (`types: ["node"]`)                                       |
    | `eslint`                | `^10`   | `./eslint`; script `lint`                                                   |
    | `prettier`              | `^3`    | `./prettier`; scripts `format` and `format:check`                           |
    | `vitest`                | `^5`    | `./vitest`; script `test`                                                   |
    | `@vitest/coverage-v8`   | `^5`    | `./vitest` (coverage, `ts:TST-6`)                                           |
    | `publint`               | `^0.3`  | `mielk-check-package`                                                       |
    | `@arethetypeswrong/cli` | `^0.18` | `mielk-check-package`                                                       |

    The versions this package is tested with are in its `devDependencies`; `mielk-lib sync` sets the same versions
    in the library.

- The ESLint rule sets (`@eslint/js`, `typescript-eslint`) are dependencies of this package; the library does not
  declare them.
- ES modules only: the package has no CommonJS build.

## Installation

```bash
npm install --save-dev --save-exact @mielk/lib-config typescript @types/node eslint prettier vitest @vitest/coverage-v8 publint @arethetypeswrong/cli
```

## Entry points

| Entry point                             | Purpose                                                                                                                 | Environments |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------ |
| `@mielk/lib-config/tsconfig.json`       | compiler options of `ts:CFG-1`–`CFG-3` with `noEmit`; base of the `tsconfig.json` of the library                        | TypeScript   |
| `@mielk/lib-config/tsconfig.build.json` | build to `dist/` with declarations: `src/**/*.ts` without `*.spec.ts`, `rootDir` `src`, `outDir` `dist` of the library  | TypeScript   |
| `@mielk/lib-config/eslint`              | `mielkEslint(options, ...extra)`, `REQUIRED_RULES`, `GENERATED_IGNORES`; types `MielkEslintOptions`, `MielkEslintExtra` | Node.js only |
| `@mielk/lib-config/prettier`            | Prettier options of `ts:LNT-2`: 4 spaces, single quotes, semicolons, trailing commas, width 120                         | Prettier     |
| `@mielk/lib-config/vitest`              | `mielkVitest(options)`, `coverageDirectory(name)`, `COVERAGE_THRESHOLD`; type `MielkVitestOptions`                      | Node.js only |

| Command (`bin`)           | Purpose                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `mielk-check-package`     | `publint --strict`, `attw --pack . --profile esm-only` and the file list of `npm pack` (`npm:PAC-1`, `PAC-3`); exit code 0 or 1 |
| `mielk-release-changelog` | `version` script of `npm version`: moves the entries of `## [Unreleased]` to `## [<version>] - <date>` (`npm:CHG-1`)            |

Each export is documented with TSDoc in the source; editors show the description, parameters and errors.

## Usage in a library

`tsconfig.json` (type check of all files, `ts:CFG-6`). The library sets `include`; options it adds (e.g.
`resolveJsonModule`) must not change the options of the package:

```json
{
    "extends": "@mielk/lib-config/tsconfig.json",
    "include": ["src/**/*.ts", "scripts/**/*.ts", "vitest.config.ts"]
}
```

`tsconfig.build.json`. A library that also builds other files (e.g. JSON from `src/locales`) adds them to `include`
together with `src/**/*.ts`, and adds compiler options it needs for them:

```json
{
    "extends": "@mielk/lib-config/tsconfig.build.json"
}
```

`eslint.config.js`. `rootDir` is required: ESLint finds the `tsconfig.json` of each file from it. `ignores` adds
patterns to `dist/`, `coverage/` and `reports/`; `allowEnv` lists the files that may read `process.env` (default
`scripts/**/*.ts`; library code takes configuration as parameters, `ts:BIB-6`). Further configuration objects come
after the options and are applied last:

```js
import { mielkEslint } from '@mielk/lib-config/eslint';

export default mielkEslint({ rootDir: import.meta.dirname });
```

`vitest.config.ts`. `name` is the library folder name; the coverage report goes to `<system temp>/<name>-coverage`
(outside a folder synced by Dropbox, `ts:TST-8`). `include` and `coverageInclude` replace the default patterns
(`src/**/*.spec.ts` and `scripts/**/*.spec.ts`; `src/**/*.ts`). Further settings are added with `mergeConfig` from
`vitest/config`:

```ts
import { mielkVitest } from '@mielk/lib-config/vitest';

export default mielkVitest({ name: 'mielk-db' });
```

`package.json` of the library (fields set by the template; other fields stay as they are):

```json
{
    "type": "module",
    "prettier": "@mielk/lib-config/prettier",
    "files": ["dist", "CHANGELOG.md"],
    "scripts": {
        "test": "vitest run --coverage",
        "build": "npm run clean && tsc -p tsconfig.build.json",
        "typecheck": "tsc --noEmit",
        "lint": "eslint . --max-warnings 0",
        "format": "prettier --write .",
        "format:check": "prettier --check .",
        "check:package": "mielk-check-package",
        "prepublishOnly": "npm run typecheck && npm run lint && npm test && npm run build && npm run check:package",
        "version": "mielk-release-changelog && git add CHANGELOG.md"
    }
}
```

The full `clean` script and the other template files are in `fixtures/sample-lib/`, the sample library of the
integration test. A library that uses the package has no `.prettierrc*`, `scripts/check-pack-files.ts` or
`scripts/release-changelog.ts`, and no direct dependencies on `@eslint/js` and `typescript-eslint`.

## Updating a library to a new version

1. Raise `@mielk/lib-config` and the peer dependencies in `devDependencies` to the versions of the new release
   (`mielk-lib sync` in `mielk-npm-tools` does it from the version installed there), then `npm install`.
2. Read the entries of the new version in [CHANGELOG.md](CHANGELOG.md); a major version lists the migration steps.
3. Run `format:check`, `lint`, `typecheck`, `test`, `build` and `check:package`. The change touches only
   `devDependencies` and tool files, so the library does not release a new version for it (`npm:CHG-2`).

## Development

| Command                                   | Purpose                                                                                                                                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                  | install dependencies from `package-lock.json`                                                                                                                                                                                               |
| `npm test`                                | all unit tests (Vitest) with coverage; threshold 80% of lines and branches; report in the system temp folder                                                                                                                                |
| `npm run test:watch`                      | tests in watch mode                                                                                                                                                                                                                         |
| `npm run test:integration`                | after `npm run build`: installs the packed package in a copy of `fixtures/sample-lib` and runs its `format:check`, `lint`, `typecheck`, `test`, `build` and `check:package`; downloads packages from npm; `-- --keep` keeps the temp folder |
| `npm run typecheck`                       | TypeScript check without output                                                                                                                                                                                                             |
| `npm run lint`                            | ESLint with type information, no warnings allowed                                                                                                                                                                                           |
| `npm run format` / `npm run format:check` | Prettier                                                                                                                                                                                                                                    |
| `npm run build`                           | compiles `src` to `dist` and copies `config/*.json` to `dist/config`                                                                                                                                                                        |
| `npm run check:package`                   | `mielk-check-package` of this package, from `dist`                                                                                                                                                                                          |

The package uses its own configuration: `eslint.config.js` and `vitest.config.ts` import the sources from `src/`,
`tsconfig.json` and `tsconfig.build.json` extend the files in `config/`, and `package.json` points Prettier to
`config/prettier.json`. CI (`.github/workflows/ci.yml`) runs the checks of `npm:PUB-2`, the integration test and
`npm audit --audit-level=high` of all dependencies, because the peer dependencies are the tools of every library.

## Releasing a new version

1. Add the changes under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md). Changing a rule, an option or a peer
   dependency range that can make the checks of a library fail is a breaking change (major version, entry starting
   with `**Breaking:**` and the migration steps, `npm:SEM-1`, `npm:CHG-3`).
2. `npm version <major|minor|patch> -m "Release %s (<TASK-ID>)"` on the current `master` (`npm:WYD-1`, `WYD-3`). Its
   `version` script builds the package and runs `mielk-release-changelog` from `dist`. Push with
   `git push --follow-tags` (`npm:WYD-4`).
3. The user starts the `CI` workflow on the tag `v<version>` (`workflow_dispatch`); the `publish` job publishes the
   package with trusted publishing (`npm:PUB-1`, `PUB-5`). Agents do not publish.
4. Raise `@mielk/lib-config` in `devDependencies` of `mielk-npm-tools`: `mielk-lib sync` takes the template versions
   from the package installed there, and libraries pick up the new version with `mielk-lib sync`.

## Releases and changes

Changes are listed by hand in [CHANGELOG.md](CHANGELOG.md) under `Unreleased`; it also holds the migration notes
between major versions.

## Documentation scope

Deviation from the documentation standard (`doc:SCP-1`, `doc:SCP-4`), as approved by the user for the mielk
libraries on 2026-11-13 (TASK-188) and applied to this package in TASK-210: the package has no generated user and
technical documentation sites, API reference or agent documentation (`doc/agent/CORE.md`), because the
documentation generator for TypeScript (TASK-197) is not finished yet. Until it is, this README, the TSDoc
comments of every export and [CHANGELOG.md](CHANGELOG.md) are the complete documentation.

## License

[MIT](LICENSE)
