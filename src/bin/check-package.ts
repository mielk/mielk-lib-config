#!/usr/bin/env node
// Command `mielk-check-package`: the package check of the library in the current folder (npm:PAC-1, npm:PAC-3).
// Run it after the build: `"check:package": "mielk-check-package"`.
import { checkPackage } from '../check-package.js';
import { runCommand } from '../cli.js';

process.exitCode = runCommand('mielk-check-package', () =>
    checkPackage({
        folder: process.cwd(),
        node: process.execPath,
        npmCli: process.env.npm_execpath,
    }),
);
