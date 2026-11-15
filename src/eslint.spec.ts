import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GENERATED_IGNORES, REQUIRED_RULES, mielkEslint } from './eslint.js';

describe('mielkEslint', () => {
    it('ignores the generated folders and the extra patterns', () => {
        const [first] = mielkEslint({ rootDir: '/lib', ignores: ['fixtures/'] });
        expect(first).toEqual({ ignores: [...GENERATED_IGNORES, 'fixtures/'] });
    });

    it('sets the required rules as errors with type information from the root folder', () => {
        const shared = mielkEslint({ rootDir: '/lib' }).find((config) => config.languageOptions?.parserOptions);
        expect(shared?.rules).toEqual(REQUIRED_RULES);
        expect(shared?.languageOptions?.parserOptions).toEqual({
            projectService: { allowDefaultProject: ['*.js'] },
            tsconfigRootDir: '/lib',
        });
    });

    it('allows process.env in scripts by default and in the given files otherwise', () => {
        const allowed = (config: ReturnType<typeof mielkEslint>) =>
            config.filter((c) => c.rules?.['no-restricted-properties'] === 'off').map((c) => c.files);
        expect(allowed(mielkEslint({ rootDir: '/lib' }))).toEqual([['scripts/**/*.ts']]);
        expect(allowed(mielkEslint({ rootDir: '/lib', allowEnv: ['tools/*.ts'] }))).toEqual([['tools/*.ts']]);
        expect(allowed(mielkEslint({ rootDir: '/lib', allowEnv: [] }))).toEqual([]);
    });

    it('appends the extra configuration objects after the shared ones', () => {
        const extra = { files: ['src/**/*.ts'], rules: { 'no-console': 'error' as const } };
        const config = mielkEslint({ rootDir: '/lib' }, extra);
        expect(config.at(-1)).toEqual(extra);
    });

    it('throws when the root folder is empty', () => {
        expect(() => mielkEslint({ rootDir: '' })).toThrow('rootDir is required');
    });
});

describe('mielkEslint on a library', () => {
    let root: string;
    let eslint: ESLint;

    const ruleIds = async (file: string, code: string): Promise<(string | null)[]> => {
        const [result] = await eslint.lintText(code, { filePath: join(root, file) });
        return (result?.messages ?? []).map((message) => message.ruleId);
    };

    beforeAll(() => {
        root = mkdtempSync(join(tmpdir(), 'mielk-lib-config-eslint-'));
        mkdirSync(join(root, 'src'));
        mkdirSync(join(root, 'scripts'));
        writeFileSync(
            join(root, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: { strict: true, module: 'nodenext', moduleResolution: 'nodenext', types: [] },
                include: ['src/**/*.ts', 'scripts/**/*.ts'],
            }),
        );
        writeFileSync(join(root, 'src', 'index.ts'), '');
        writeFileSync(join(root, 'scripts', 'tool.ts'), '');
        eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: mielkEslint({ rootDir: root }) });
    });

    afterAll(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('reports any and process.env in library code', async () => {
        const code = 'declare const process: { env: Record<string, string> };\nexport const a: any = process.env;\n';
        expect(await ruleIds('src/index.ts', code)).toEqual([
            '@typescript-eslint/no-explicit-any',
            'no-restricted-properties',
        ]);
    });

    it('allows process.env in repository scripts', async () => {
        const code = 'declare const process: { env: Record<string, string> };\nexport const a = process.env;\n';
        expect(await ruleIds('scripts/tool.ts', code)).toEqual([]);
    });

    it('reports a floating promise through type information', async () => {
        const code = 'const run = async (): Promise<void> => {};\nrun();\n';
        expect(await ruleIds('src/index.ts', code)).toEqual(['@typescript-eslint/no-floating-promises']);
    });

    it('lints JavaScript files without type information', async () => {
        expect(await ruleIds('eslint.config.js', 'export default [];\n')).toEqual([]);
    });
});
