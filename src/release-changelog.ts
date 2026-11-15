// Logic of the command `mielk-release-changelog` (src/bin/release-changelog.ts), the `version` lifecycle script of
// `npm version` (npm:WYD-1, npm:CHG-1, npm:CHG-2): moves the entries of `## [Unreleased]` in CHANGELOG.md to a new
// section `## [<version>] - <YYYY-MM-DD>` right below it.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UNRELEASED = '## [Unreleased]';

/**
 * Returns the changelog with the Unreleased entries moved to a section of the given version.
 *
 * @param changelog Content of CHANGELOG.md.
 * @param version The released version, e.g. `2.0.0`.
 * @param date Release date as `YYYY-MM-DD`.
 * @returns The new content; Unreleased stays as an empty section on top. A file with Windows line endings (CRLF) keeps
 *   them in the whole content, also in the inserted lines, so a working copy with `core.autocrlf` gets no mixed endings.
 * @throws {Error} When there is no Unreleased section, it has no entry, or the version is already listed.
 */
export const releaseChangelog = (changelog: string, version: string, date: string): string => {
    if (!changelog.includes('\r\n')) return releaseLf(changelog, version, date);
    return releaseLf(changelog.replace(/\r\n/g, '\n'), version, date).replace(/\n/g, '\r\n');
};

/** {@link releaseChangelog} for content with LF line endings only. */
const releaseLf = (changelog: string, version: string, date: string): string => {
    const start = changelog.indexOf(UNRELEASED);
    if (start === -1) throw new Error(`CHANGELOG.md has no "${UNRELEASED}" section.`);
    if (changelog.includes(`## [${version}]`)) throw new Error(`CHANGELOG.md already has a section for ${version}.`);
    const bodyStart = start + UNRELEASED.length;
    // A version heading ends the section; versions released with standard-version use '### [x.y.z]'.
    const next = changelog.slice(bodyStart).search(/\n#{2,3} \[/);
    const bodyEnd = next === -1 ? changelog.length : bodyStart + next + 1;
    const body = changelog.slice(bodyStart, bodyEnd);
    if (!/^- /m.test(body))
        throw new Error(`"${UNRELEASED}" has no entries; a version without changes is not released.`);
    const entries = body.trim();
    return `${changelog.slice(0, bodyStart)}\n\n## [${version}] - ${date}\n\n${entries}\n\n${changelog.slice(bodyEnd)}`;
};

/**
 * Applies {@link releaseChangelog} to `CHANGELOG.md` in a folder.
 *
 * @param folder Root folder of the library (the working folder of `npm version`).
 * @param version The released version; `undefined` when the command is not run by `npm version`.
 * @param date Release date as `YYYY-MM-DD`.
 * @throws {Error} When the version is missing, the file cannot be read or written, or {@link releaseChangelog}
 *   rejects the content.
 */
export const releaseChangelogFile = (folder: string, version: string | undefined, date: string): void => {
    if (!version) throw new Error('npm_package_version is not set; run this command through npm version.');
    const path = join(folder, 'CHANGELOG.md');
    writeFileSync(path, releaseChangelog(readFileSync(path, 'utf8'), version, date));
};
