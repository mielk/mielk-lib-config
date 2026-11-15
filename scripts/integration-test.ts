// Integration test of the package (plan TASK-210, criterion K5): packs the built package with `npm pack`, installs the
// tarball in a copy of fixtures/sample-lib in the system temp folder and runs the checks a mielk library runs in CI
// and the changelog step of `npm version`.
// A defect of the shared configuration then fails here, before a release, and not in every library at once.
// The sample library gets the peer dependencies in the versions of devDependencies of this package, so the test uses
// the versions the package is released with. The installation downloads packages from the npm registry, so this test
// is not part of `npm test` (ts:TST-5); CI runs it after the build.
// Usage: npm run build && npm run test:integration [-- --keep]   (--keep leaves the temp folder for inspection)
// Node.js runs this TypeScript file directly by stripping its types, so the file uses only erasable syntax and
// imports only Node.js modules and zod.
import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';

// JSON read from files and from `npm pack` is validated at the boundary (ts:TYP-2); the sample manifest keeps all its
// other fields, because the script writes it back.
const versions = z.record(z.string(), z.string());
const ownManifestSchema = z.object({ peerDependencies: versions, devDependencies: versions });
const sampleManifestSchema = z.looseObject({ devDependencies: versions.optional() });
const packListSchema = z.tuple([z.object({ filename: z.string() })]);

const root = resolve(import.meta.dirname, '..');
const keep = process.argv.includes('--keep');
const npmCli = process.env.npm_execpath;

/** Runs npm with arguments in a folder; prints its output and returns its exit code and captured output. */
const npm = (folder: string, args: string[], capture = false): { status: number | null; stdout: string } => {
    const options: SpawnSyncOptionsWithStringEncoding = {
        cwd: folder,
        encoding: 'utf8',
        stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    };
    const result = npmCli
        ? spawnSync(process.execPath, [npmCli, ...args], options)
        : spawnSync(`npm ${args.join(' ')}`, { ...options, shell: true });
    return { status: result.status, stdout: typeof result.stdout === 'string' ? result.stdout : '' };
};

/** Error of a failed step; the message names the step. */
class StepError extends Error {}

const fail = (message: string): never => {
    throw new StepError(message);
};

const work = mkdtempSync(join(tmpdir(), 'mielk-lib-config-it-'));
let passed = false;
try {
    if (!existsSync(join(root, 'dist', 'eslint.js'))) fail('dist/ is missing; run npm run build first.');
    const packed = npm(root, ['pack', '--pack-destination', work, '--json'], true);
    if (packed.status !== 0) fail('npm pack');
    const list = packListSchema.safeParse(JSON.parse(packed.stdout));
    const tarball = join(work, list.success ? list.data[0].filename : fail('npm pack printed no package'));

    const sample = join(work, 'sample-lib');
    cpSync(join(root, 'fixtures', 'sample-lib'), sample, { recursive: true });
    const own = ownManifestSchema.parse(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')));
    const manifestPath = join(sample, 'package.json');
    const manifest = sampleManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));
    const devDependencies: Record<string, string> = { '@mielk/lib-config': `file:${tarball}` };
    for (const name of Object.keys(own.peerDependencies)) {
        devDependencies[name] =
            own.devDependencies[name] ?? fail(`peer dependency ${name} has no version in devDependencies (npm:ZAL-2)`);
    }
    manifest.devDependencies = devDependencies;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);

    console.log(`\n> npm install (${sample})`);
    if (npm(sample, ['install', '--no-audit', '--no-fund']).status !== 0) fail('npm install');
    for (const script of ['format:check', 'lint', 'typecheck', 'test', 'build', 'check:package']) {
        console.log(`\n> npm run ${script}`);
        if (npm(sample, ['run', script]).status !== 0) fail(`npm run ${script} in the sample library`);
    }

    // The release step: `npm version` runs the `version` script with mielk-release-changelog. `git add` in that
    // script needs a repository; --no-git-tag-version keeps npm from committing and tagging.
    console.log('\n> npm version minor --no-git-tag-version');
    if (spawnSync('git', ['init', '-q'], { cwd: sample, stdio: 'inherit' }).status !== 0) fail('git init');
    if (npm(sample, ['version', 'minor', '--no-git-tag-version']).status !== 0) fail('npm version');
    const changelog = readFileSync(join(sample, 'CHANGELOG.md'), 'utf8');
    if (!/^## \[Unreleased\]\n\n## \[1\.1\.0\] - \d{4}-\d{2}-\d{2}\n\n### Changed\n/m.test(changelog))
        fail(`npm version did not move the Unreleased entries to 1.1.0:\n${changelog}`);

    passed = true;
    console.log('\nIntegration test: OK (format:check, lint, typecheck, test, build, check:package, version).');
} catch (err) {
    if (!(err instanceof StepError)) throw err;
    console.error(`Integration test failed: ${err.message}`);
    process.exitCode = 1;
} finally {
    if (keep || !passed) console.log(`Temp folder kept: ${work}`);
    else rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
