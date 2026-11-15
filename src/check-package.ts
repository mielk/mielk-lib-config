// Logic of the command `mielk-check-package` (src/bin/check-package.ts): the package check of a built library in one
// command (npm:PAC-1, npm:PAC-3). It runs `publint --strict` and `attw --pack . --profile esm-only` installed in the
// library and checks the file list of `npm pack --dry-run --json`.
import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT_FILES = new Set(['package.json', 'README.md', 'LICENSE', 'CHANGELOG.md']);

/**
 * Tells whether a file may be part of the published package (npm:PAC-1).
 *
 * @param path Path of the file inside the package, with forward slashes, e.g. `dist/index.js`.
 * @returns `true` for the allowed root files and for files from `dist/` that are not tests or source maps.
 */
export const isAllowedPackFile = (path: string): boolean => {
    if (ROOT_FILES.has(path)) return true;
    if (!path.startsWith('dist/')) return false;
    const name = path.slice(path.lastIndexOf('/') + 1);
    return !name.endsWith('.map') && !/\.spec\./.test(name);
};

/**
 * Returns the files of the package that are not allowed (npm:PAC-1).
 *
 * @param packJson Output of `npm pack --dry-run --json`.
 * @returns Paths of the files that break npm:PAC-1, in the order of the output.
 * @throws {Error} When the output is not the JSON array printed by `npm pack --json`.
 */
export const disallowedPackFiles = (packJson: string): string[] => {
    const parsed: unknown = JSON.parse(packJson);
    if (!Array.isArray(parsed) || parsed.length !== 1) throw new Error('Expected the output of npm pack --json.');
    const files: unknown = (parsed[0] as { files?: unknown }).files;
    if (!Array.isArray(files)) throw new Error('The output of npm pack --json has no file list.');
    return files.map((file) => (file as { path: string }).path).filter((path) => !isAllowedPackFile(path));
};

/**
 * Finds the script of a command of a package installed in a library, searching `node_modules` from the folder up,
 * as Node.js resolves packages.
 *
 * @param name Package name, e.g. `publint`.
 * @param command Name of the command in the `bin` field of the package, e.g. `attw`.
 * @param folder Folder to start the search from, usually the root folder of the library.
 * @returns Absolute path of the script.
 * @throws {Error} When the package is not installed or has no such command.
 */
export const findPackageBin = (name: string, command: string, folder: string): string => {
    for (let dir = resolve(folder); ; dir = dirname(dir)) {
        const manifest = join(dir, 'node_modules', name, 'package.json');
        if (existsSync(manifest)) {
            const bin: unknown = (JSON.parse(readFileSync(manifest, 'utf8')) as { bin?: unknown }).bin;
            const path = typeof bin === 'string' ? bin : (bin as Record<string, unknown> | undefined)?.[command];
            if (typeof path !== 'string') throw new Error(`Package ${name} has no command ${command}.`);
            return join(dirname(manifest), path);
        }
        if (dirname(dir) === dir) break;
    }
    throw new Error(`${name} is not installed; add it to devDependencies of the library (npm:PAC-3).`);
};

/** Result of a command run by {@link CommandRunner}. */
export type CommandResult = {
    /** Exit code; `null` when the command did not start or was stopped by a signal. */
    status: number | null;
    /** Standard output when it was captured, otherwise an empty string. */
    stdout: string;
};

/**
 * Runs a command in a folder. `capture: false` passes the output to the console; `capture: true` returns the
 * standard output and passes only the error output.
 */
export type CommandRunner = (command: Command, folder: string, capture: boolean) => CommandResult;

/** A command to run: an executable with arguments, or a command line for the system shell (`shell`). */
export type Command = { file: string; args: string[] } | { shell: string };

/** Runs the command with `spawnSync`; the default {@link CommandRunner}. */
export const spawnRunner: CommandRunner = (command, folder, capture) => {
    const options: SpawnSyncOptionsWithStringEncoding = {
        cwd: folder,
        encoding: 'utf8',
        stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    };
    const result =
        'shell' in command
            ? spawnSync(command.shell, { ...options, shell: true })
            : spawnSync(command.file, command.args, options);
    return { status: result.status, stdout: typeof result.stdout === 'string' ? result.stdout : '' };
};

/** Settings of {@link checkPackage}. */
export type CheckPackageOptions = {
    /** Root folder of the built library. */
    folder: string;
    /** Path of the Node.js executable that runs `publint`, `attw` and npm, normally `process.execPath`. */
    node: string;
    /**
     * Path of the npm script (`npm_execpath` set by npm for a run of `npm run`). Without it the check runs `npm` through
     * the system shell.
     */
    npmCli?: string | undefined;
    /** Runs the commands; default {@link spawnRunner}. */
    run?: CommandRunner;
    /** Receives the messages of the check; default `console`. */
    log?: Pick<Console, 'log' | 'error'>;
};

/**
 * Checks a built library before publication: `publint --strict`, `attw --pack . --profile esm-only` (npm:PAC-3) and the
 * file list of `npm pack --dry-run --json` (npm:PAC-1). Stops at the first failed step.
 *
 * @param options Folder of the library, Node.js and npm paths, and optional runner and log.
 * @returns Exit code of the check: 0 when all steps pass, 1 otherwise.
 * @throws {Error} When `publint` or `@arethetypeswrong/cli` is not installed in the library, or `npm pack` prints
 *   output that is not a package file list.
 */
export const checkPackage = (options: CheckPackageOptions): number => {
    const { folder, node } = options;
    const run = options.run ?? spawnRunner;
    const log = options.log ?? console;
    const steps: { label: string; command: Command }[] = [
        {
            label: 'publint --strict',
            command: { file: node, args: [findPackageBin('publint', 'publint', folder), '--strict'] },
        },
        {
            label: 'attw --pack . --profile esm-only',
            command: {
                file: node,
                args: [findPackageBin('@arethetypeswrong/cli', 'attw', folder), '--pack', '.', '--profile', 'esm-only'],
            },
        },
    ];
    for (const step of steps) {
        if (run(step.command, folder, false).status !== 0) {
            log.error(`Package check failed: ${step.label} (npm:PAC-3).`);
            return 1;
        }
    }
    const pack: Command = options.npmCli
        ? { file: node, args: [options.npmCli, 'pack', '--dry-run', '--json'] }
        : { shell: 'npm pack --dry-run --json' };
    const packed = run(pack, folder, true);
    if (packed.status !== 0) {
        log.error('Package check failed: npm pack --dry-run --json.');
        return 1;
    }
    const disallowed = disallowedPackFiles(packed.stdout);
    if (disallowed.length > 0) {
        log.error(`Files not allowed in the package (npm:PAC-1):\n${disallowed.join('\n')}`);
        return 1;
    }
    log.log('Package content: OK (npm:PAC-1).');
    return 0;
};
