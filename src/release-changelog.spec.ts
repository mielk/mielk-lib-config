import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { releaseChangelog, releaseChangelogFile } from './release-changelog.js';

const HEADER = '# Changelog\n\nIntro.\n\n';
const OLD = '## [1.0.0] - 2026-01-01\n\n### Fixed\n\n- Old fix.\n';

describe('releaseChangelog', () => {
    it('moves the Unreleased entries to a section of the version and leaves Unreleased empty', () => {
        const changelog = `${HEADER}## [Unreleased]\n\n### Added\n\n- New thing (TASK-1).\n\n${OLD}`;
        expect(releaseChangelog(changelog, '1.1.0', '2026-11-13')).toBe(
            `${HEADER}## [Unreleased]\n\n## [1.1.0] - 2026-11-13\n\n### Added\n\n- New thing (TASK-1).\n\n${OLD}`,
        );
    });

    it('handles an Unreleased section that is the last section', () => {
        const changelog = `${HEADER}## [Unreleased]\n\n### Fixed\n\n- Fix.\n`;
        expect(releaseChangelog(changelog, '1.0.1', '2026-11-13')).toBe(
            `${HEADER}## [Unreleased]\n\n## [1.0.1] - 2026-11-13\n\n### Fixed\n\n- Fix.\n\n`,
        );
    });

    it('ends the file with a single newline when Unreleased is the only section (first release)', () => {
        const changelog = `${HEADER}## [Unreleased]\n\n### Added\n\n- First release.\n`;
        const released = releaseChangelog(changelog, '1.0.0', '2026-11-15');
        expect(released).toBe(`${HEADER}## [Unreleased]\n\n## [1.0.0] - 2026-11-15\n\n### Added\n\n- First release.\n`);
        expect(released.endsWith('\n\n')).toBe(false);
    });

    it('keeps the Windows line endings of a CRLF file, also in the inserted lines', () => {
        const crlf = (text: string): string => text.replace(/\n/g, '\r\n');
        const changelog = crlf(`${HEADER}## [Unreleased]\n\n### Fixed\n\n- Fix.\n\n${OLD}`);
        const released = releaseChangelog(changelog, '1.0.1', '2026-11-15');
        expect(released).toBe(
            crlf(`${HEADER}## [Unreleased]\n\n## [1.0.1] - 2026-11-15\n\n### Fixed\n\n- Fix.\n\n${OLD}`),
        );
        expect(released.replace(/\r\n/g, '')).not.toContain('\n');
    });

    it('stops at a version heading of level three left by standard-version', () => {
        const legacy = '### [1.2.6](https://example.com) (2026-04-03)\n\n### Bug Fixes\n\n- Old fix.\n';
        const changelog = `${HEADER}## [Unreleased]\n\n### Fixed\n\n- Fix.\n\n${legacy}`;
        expect(releaseChangelog(changelog, '2.0.0', '2026-11-13')).toBe(
            `${HEADER}## [Unreleased]\n\n## [2.0.0] - 2026-11-13\n\n### Fixed\n\n- Fix.\n\n${legacy}`,
        );
    });

    it('throws when Unreleased has no entries', () => {
        const changelog = `${HEADER}## [Unreleased]\n\n### Added\n\n${OLD}`;
        expect(() => releaseChangelog(changelog, '1.1.0', '2026-11-13')).toThrow(/no entries/);
    });

    it('throws when there is no Unreleased section', () => {
        expect(() => releaseChangelog(`${HEADER}${OLD}`, '1.1.0', '2026-11-13')).toThrow(/no "## \[Unreleased\]"/);
    });

    it('throws when the version already has a section', () => {
        const changelog = `${HEADER}## [Unreleased]\n\n- Fix.\n\n${OLD}`;
        expect(() => releaseChangelog(changelog, '1.0.0', '2026-11-13')).toThrow(/already has a section/);
    });
});

describe('releaseChangelogFile', () => {
    let folder: string;

    beforeEach(() => {
        folder = mkdtempSync(join(tmpdir(), 'mielk-lib-config-changelog-'));
    });

    afterEach(() => {
        rmSync(folder, { recursive: true, force: true });
    });

    it('rewrites CHANGELOG.md of the folder', () => {
        writeFileSync(join(folder, 'CHANGELOG.md'), `${HEADER}## [Unreleased]\n\n- Fix.\n`);
        releaseChangelogFile(folder, '1.0.0', '2026-11-15');
        expect(readFileSync(join(folder, 'CHANGELOG.md'), 'utf8')).toBe(
            `${HEADER}## [Unreleased]\n\n## [1.0.0] - 2026-11-15\n\n- Fix.\n\n`,
        );
    });

    it('throws without a version and leaves the file unchanged', () => {
        writeFileSync(join(folder, 'CHANGELOG.md'), `${HEADER}## [Unreleased]\n\n- Fix.\n`);
        expect(() => releaseChangelogFile(folder, undefined, '2026-11-15')).toThrow(/npm_package_version/);
        expect(() => releaseChangelogFile(folder, '', '2026-11-15')).toThrow(/npm_package_version/);
        expect(readFileSync(join(folder, 'CHANGELOG.md'), 'utf8')).toBe(`${HEADER}## [Unreleased]\n\n- Fix.\n`);
    });

    it('throws when the folder has no CHANGELOG.md', () => {
        expect(() => releaseChangelogFile(folder, '1.0.0', '2026-11-15')).toThrow(/ENOENT/);
    });
});
