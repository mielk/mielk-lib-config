// Shared Vitest configuration of the mielk libraries (ts:TST-1, ts:TST-6, ts:TST-8). The file has no relative
// imports, so the repository of this package can load it from source in its own vitest.config.ts.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, type ViteUserConfig } from 'vitest/config';

/** Options of {@link mielkVitest}. */
export type MielkVitestOptions = {
    /** Name of the library folder, e.g. `mielk-db`; the coverage report goes to `<system temp>/<name>-coverage`. */
    name: string;
    /** Test files. Default: `['src/**\/*.spec.ts', 'scripts/**\/*.spec.ts']`. */
    include?: string[];
    /** Files measured by coverage. Default: `['src/**\/*.ts']`; test files are always excluded. */
    coverageInclude?: string[];
};

/** Minimum share of covered lines and branches in a library, in percent (ts:TST-6). */
export const COVERAGE_THRESHOLD = 80;

/**
 * Returns the folder of the coverage report of a library: the system temp folder, outside a working copy synced by
 * Dropbox, which locks the files Vitest removes after the run (ts:TST-8).
 *
 * @param name Name of the library folder, e.g. `mielk-db`.
 * @returns Absolute path `<system temp>/<name>-coverage`.
 */
export const coverageDirectory = (name: string): string => join(tmpdir(), `${name}-coverage`);

/**
 * Builds the Vitest configuration of a mielk library: unit tests next to the modules (`*.spec.ts`), coverage by
 * `@vitest/coverage-v8` with a threshold of 80% of lines and branches, and the report in the system temp folder.
 * Further settings are added with `mergeConfig` from `vitest/config`.
 *
 * @param options Name of the library folder and optional test and coverage patterns.
 * @returns The configuration to export as default from `vitest.config.ts`.
 * @throws {Error} When `name` is empty or contains a path separator.
 *
 * @example
 * ```ts
 * // vitest.config.ts
 * import { mielkVitest } from '@mielk/lib-config/vitest';
 *
 * export default mielkVitest({ name: 'mielk-db' });
 * ```
 */
export const mielkVitest = (options: MielkVitestOptions): ViteUserConfig => {
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(options.name))
        throw new Error(`mielkVitest: name must be the library folder name, e.g. mielk-db; got "${options.name}".`);
    return defineConfig({
        test: {
            include: options.include ?? ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
            coverage: {
                provider: 'v8',
                include: options.coverageInclude ?? ['src/**/*.ts'],
                exclude: ['**/*.spec.ts'],
                reporter: ['text', 'html'],
                reportsDirectory: coverageDirectory(options.name),
                thresholds: { lines: COVERAGE_THRESHOLD, branches: COVERAGE_THRESHOLD },
            },
        },
    });
};
