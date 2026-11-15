import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    checkPackage,
    disallowedPackFiles,
    findPackageBin,
    isAllowedPackFile,
    spawnRunner,
    type Command,
    type CommandRunner,
} from './check-package.js';

const pack = (paths: string[]): string => JSON.stringify([{ files: paths.map((path) => ({ path })) }]);

describe('isAllowedPackFile', () => {
    it.each(['package.json', 'README.md', 'LICENSE', 'CHANGELOG.md', 'dist/index.js', 'dist/config/tsconfig.json'])(
        'allows %s',
        (path) => {
            expect(isAllowedPackFile(path)).toBe(true);
        },
    );

    it.each(['src/index.ts', 'dist/index.js.map', 'dist/arrays/index.spec.js', 'tsconfig.json', 'docs/README.md'])(
        'rejects %s',
        (path) => {
            expect(isAllowedPackFile(path)).toBe(false);
        },
    );
});

describe('disallowedPackFiles', () => {
    it('returns an empty list for a package with allowed files only', () => {
        expect(disallowedPackFiles(pack(['package.json', 'LICENSE', 'dist/index.js']))).toEqual([]);
    });

    it('returns the disallowed files in the order of the output', () => {
        expect(disallowedPackFiles(pack(['src/a.ts', 'dist/index.js', 'dist/index.js.map']))).toEqual([
            'src/a.ts',
            'dist/index.js.map',
        ]);
    });

    it('throws when the output is not a single-package array', () => {
        expect(() => disallowedPackFiles('{}')).toThrow('Expected the output of npm pack --json.');
        expect(() => disallowedPackFiles('[]')).toThrow('Expected the output of npm pack --json.');
    });

    it('throws when the package has no file list', () => {
        expect(() => disallowedPackFiles('[{}]')).toThrow('has no file list');
    });
});

/** Creates a fake installed package `node_modules/<name>` with the given `bin` field under a folder. */
const installFake = (folder: string, name: string, bin: unknown): void => {
    const dir = join(folder, 'node_modules', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, bin }));
};

describe('findPackageBin', () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'mielk-lib-config-bin-'));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('returns the script of a bin field written as a string', () => {
        installFake(root, 'publint', 'src/cli.js');
        expect(findPackageBin('publint', 'publint', root)).toBe(join(root, 'node_modules', 'publint', 'src/cli.js'));
    });

    it('returns the script of the named command of a bin object', () => {
        installFake(root, '@arethetypeswrong/cli', { attw: 'dist/index.js' });
        expect(findPackageBin('@arethetypeswrong/cli', 'attw', root)).toBe(
            join(root, 'node_modules', '@arethetypeswrong/cli', 'dist/index.js'),
        );
    });

    it('finds a package installed in a parent folder', () => {
        installFake(root, 'publint', 'src/cli.js');
        const nested = join(root, 'packages', 'lib');
        mkdirSync(nested, { recursive: true });
        expect(findPackageBin('publint', 'publint', nested)).toBe(join(root, 'node_modules', 'publint', 'src/cli.js'));
    });

    it('throws when the package has no such command', () => {
        installFake(root, 'publint', { other: 'x.js' });
        expect(() => findPackageBin('publint', 'publint', root)).toThrow('Package publint has no command publint.');
        installFake(root, 'nobin', undefined);
        expect(() => findPackageBin('nobin', 'nobin', root)).toThrow('Package nobin has no command nobin.');
    });

    it('throws when the package is not installed', () => {
        expect(() => findPackageBin('not-installed-package-xyz', 'x', root)).toThrow(/is not installed/);
    });
});

describe('checkPackage', () => {
    let root: string;
    const log = { log: vi.fn(), error: vi.fn() };

    /** A runner that records the commands and answers with the given exit codes and npm pack output. */
    const fakeRunner = (statuses: number[], packOutput = pack(['package.json', 'dist/index.js'])) => {
        const calls: { command: Command; capture: boolean }[] = [];
        const run: CommandRunner = (command, _folder, capture) => {
            calls.push({ command, capture });
            return { status: statuses[calls.length - 1] ?? 0, stdout: capture ? packOutput : '' };
        };
        return { run, calls };
    };

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'mielk-lib-config-check-'));
        installFake(root, 'publint', 'src/cli.js');
        installFake(root, '@arethetypeswrong/cli', { attw: 'dist/index.js' });
        log.log.mockClear();
        log.error.mockClear();
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('runs publint, attw and npm pack with the installed tools and returns 0', () => {
        const { run, calls } = fakeRunner([0, 0, 0]);
        expect(checkPackage({ folder: root, node: 'node', npmCli: 'npm-cli.js', run, log })).toBe(0);
        expect(calls).toEqual([
            {
                command: { file: 'node', args: [join(root, 'node_modules', 'publint', 'src/cli.js'), '--strict'] },
                capture: false,
            },
            {
                command: {
                    file: 'node',
                    args: [
                        join(root, 'node_modules', '@arethetypeswrong/cli', 'dist/index.js'),
                        '--pack',
                        '.',
                        '--profile',
                        'esm-only',
                    ],
                },
                capture: false,
            },
            { command: { file: 'node', args: ['npm-cli.js', 'pack', '--dry-run', '--json'] }, capture: true },
        ]);
        expect(log.log).toHaveBeenCalledWith('Package content: OK (npm:PAC-1).');
    });

    it('runs npm through the shell when the npm script path is not known', () => {
        const { run, calls } = fakeRunner([0, 0, 0]);
        expect(checkPackage({ folder: root, node: 'node', run, log })).toBe(0);
        expect(calls[2]).toEqual({ command: { shell: 'npm pack --dry-run --json' }, capture: true });
    });

    it.each([
        [0, 'publint --strict'],
        [1, 'attw --pack . --profile esm-only'],
    ])('stops and returns 1 when step %i fails', (failed, label) => {
        const statuses = [0, 0, 0];
        statuses[failed] = 1;
        const { run, calls } = fakeRunner(statuses);
        expect(checkPackage({ folder: root, node: 'node', run, log })).toBe(1);
        expect(calls).toHaveLength(failed + 1);
        expect(log.error).toHaveBeenCalledWith(`Package check failed: ${label} (npm:PAC-3).`);
    });

    it('returns 1 when npm pack fails', () => {
        const { run } = fakeRunner([0, 0, 1]);
        expect(checkPackage({ folder: root, node: 'node', run, log })).toBe(1);
        expect(log.error).toHaveBeenCalledWith('Package check failed: npm pack --dry-run --json.');
    });

    it('returns 1 and lists the files not allowed in the package', () => {
        const { run } = fakeRunner([0, 0, 0], pack(['package.json', 'src/index.ts', 'dist/index.js.map']));
        expect(checkPackage({ folder: root, node: 'node', run, log })).toBe(1);
        expect(log.error).toHaveBeenCalledWith(
            'Files not allowed in the package (npm:PAC-1):\nsrc/index.ts\ndist/index.js.map',
        );
    });

    it('throws when a tool is not installed in the library', () => {
        rmSync(join(root, 'node_modules', 'publint'), { recursive: true });
        const { run, calls } = fakeRunner([]);
        expect(() => checkPackage({ folder: root, node: 'node', run, log })).toThrow(/publint is not installed/);
        expect(calls).toHaveLength(0);
    });
});

describe('spawnRunner', () => {
    it('passes the exit code of an executable and captures its output', () => {
        const result = spawnRunner(
            { file: process.execPath, args: ['-e', 'process.stdout.write("out"); process.exitCode = 3'] },
            tmpdir(),
            true,
        );
        expect(result).toEqual({ status: 3, stdout: 'out' });
    });

    it('runs a command line through the shell', () => {
        expect(spawnRunner({ shell: 'node -e "process.stdout.write(String(1 + 1))"' }, tmpdir(), true)).toEqual({
            status: 0,
            stdout: '2',
        });
    });

    it('returns an empty output when the output is not captured', () => {
        expect(spawnRunner({ file: process.execPath, args: ['-e', ''] }, tmpdir(), false)).toEqual({
            status: 0,
            stdout: '',
        });
    });
});
