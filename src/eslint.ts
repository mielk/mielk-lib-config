// Shared ESLint flat configuration of the mielk libraries (ts:LNT-1, ts:LNT-3, ts:BIB-6). The file has no relative
// imports, so the repository of this package can load it from source in its own eslint.config.js (Node.js strips
// the types).
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import type { Linter } from 'eslint';
import tseslint from 'typescript-eslint';

/** Options of {@link mielkEslint}. */
export type MielkEslintOptions = {
    /**
     * Root folder of the library, the folder of its `eslint.config.js`: pass `import.meta.dirname`. ESLint finds
     * the `tsconfig.json` of each file from this folder (type-aware rules).
     */
    rootDir: string;
    /** Patterns ignored in addition to the generated folders `dist/`, `coverage/` and `reports/`. */
    ignores?: string[];
    /**
     * Patterns of files that may read `process.env`, e.g. repository scripts run by npm. Default:
     * `['scripts/**\/*.ts']`. Library code takes its configuration as parameters (ts:BIB-6).
     */
    allowEnv?: string[];
};

/** A configuration object of an ESLint flat configuration, as accepted by `defineConfig` of `eslint/config`. */
export type MielkEslintExtra = Parameters<typeof defineConfig>[number];

/** Folders created by the build and the tests, never linted (ts:LNT-3). */
export const GENERATED_IGNORES: readonly string[] = ['dist/', 'coverage/', 'reports/'];

/** Rules that the TypeScript standard requires as errors, beyond `recommendedTypeChecked` (ts:LNT-1). */
export const REQUIRED_RULES: Readonly<Linter.RulesRecord> = {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/only-throw-error': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    // The library takes configuration as parameters and never reads the environment (ts:BIB-6, ts:ENV-1).
    'no-restricted-properties': [
        'error',
        {
            object: 'process',
            property: 'env',
            message: 'Take configuration as a parameter instead (ts:BIB-6).',
        },
    ],
};

/**
 * Builds the ESLint flat configuration of a mielk library: `@eslint/js` recommended rules, `recommendedTypeChecked`
 * of `typescript-eslint` with type information from the library's `tsconfig.json`, the rules of ts:LNT-1 as errors
 * and a ban on `process.env` outside the files in `allowEnv`. JavaScript files (e.g. `eslint.config.js`) are linted
 * without type information.
 *
 * @param options Root folder of the library and optional ignores and files allowed to read the environment.
 * @param extra Further configuration objects of the library, applied after the shared ones, so they can add rules
 *   or files (overriding a rule of {@link REQUIRED_RULES} breaks ts:LNT-1 and is reported by `mielk-lib sync --check`).
 * @returns The configuration to export as default from `eslint.config.js`.
 * @throws {Error} When `rootDir` is empty.
 *
 * @example
 * ```js
 * // eslint.config.js
 * import { mielkEslint } from '@mielk/lib-config/eslint';
 *
 * export default mielkEslint({ rootDir: import.meta.dirname });
 * ```
 */
export const mielkEslint = (options: MielkEslintOptions, ...extra: MielkEslintExtra[]): Linter.Config[] => {
    if (options.rootDir === '') throw new Error('mielkEslint: rootDir is required; pass import.meta.dirname.');
    const allowEnv = options.allowEnv ?? ['scripts/**/*.ts'];
    return defineConfig(
        { ignores: [...GENERATED_IGNORES, ...(options.ignores ?? [])] },
        js.configs.recommended,
        tseslint.configs.recommendedTypeChecked,
        {
            languageOptions: {
                parserOptions: {
                    projectService: { allowDefaultProject: ['*.js'] },
                    tsconfigRootDir: options.rootDir,
                },
            },
            rules: { ...REQUIRED_RULES },
        },
        {
            files: ['**/*.js'],
            extends: [tseslint.configs.disableTypeChecked],
        },
        ...(allowEnv.length > 0 ? [{ files: allowEnv, rules: { 'no-restricted-properties': 'off' as const } }] : []),
        ...extra,
    );
};
