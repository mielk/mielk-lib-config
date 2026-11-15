#!/usr/bin/env node
// Command `mielk-release-changelog`: the `version` lifecycle script of `npm version` (npm:CHG-1). npm sets
// npm_package_version to the new version before it runs the script; the script then adds CHANGELOG.md to the
// release commit: `"version": "mielk-release-changelog && git add CHANGELOG.md"`.
import { runCommand } from '../cli.js';
import { releaseChangelogFile } from '../release-changelog.js';

process.exitCode = runCommand('mielk-release-changelog', () => {
    releaseChangelogFile(process.cwd(), process.env.npm_package_version, new Date().toISOString().slice(0, 10));
    return 0;
});
