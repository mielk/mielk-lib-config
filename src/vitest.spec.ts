import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COVERAGE_THRESHOLD, coverageDirectory, mielkVitest } from './vitest.js';

describe('coverageDirectory', () => {
    it('returns a folder named after the library in the system temp folder', () => {
        expect(coverageDirectory('mielk-db')).toBe(join(tmpdir(), 'mielk-db-coverage'));
    });
});

describe('mielkVitest', () => {
    it('measures v8 coverage of src with an 80% line and branch threshold outside the working copy', () => {
        expect(mielkVitest({ name: 'mielk-db' }).test).toEqual({
            include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
            coverage: {
                provider: 'v8',
                include: ['src/**/*.ts'],
                exclude: ['**/*.spec.ts'],
                reporter: ['text', 'html'],
                reportsDirectory: join(tmpdir(), 'mielk-db-coverage'),
                thresholds: { lines: 80, branches: 80 },
            },
        });
        expect(COVERAGE_THRESHOLD).toBe(80);
    });

    it('takes the test and coverage patterns of the library', () => {
        const { test } = mielkVitest({ name: 'mielk-fn', include: ['lib/**/*.spec.ts'], coverageInclude: ['lib/**'] });
        expect(test?.include).toEqual(['lib/**/*.spec.ts']);
        expect(test?.coverage).toMatchObject({ include: ['lib/**'], exclude: ['**/*.spec.ts'] });
    });

    it.each(['', 'Mielk-db', '../mielk-db', 'mielk/db', '-x'])('throws for the name "%s"', (name) => {
        expect(() => mielkVitest({ name })).toThrow('name must be the library folder name');
    });
});
