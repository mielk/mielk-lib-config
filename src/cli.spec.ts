import { describe, expect, it, vi } from 'vitest';
import { runCommand } from './cli.js';

describe('runCommand', () => {
    it('returns the exit code of the command and prints nothing', () => {
        const log = { error: vi.fn() };
        expect(runCommand('cmd', () => 3, log)).toBe(3);
        expect(log.error).not.toHaveBeenCalled();
    });

    it('turns a thrown error into a message with the command name and exit code 1', () => {
        const log = { error: vi.fn() };
        const code = runCommand(
            'mielk-check-package',
            () => {
                throw new Error('publint is not installed.');
            },
            log,
        );
        expect(code).toBe(1);
        expect(log.error).toHaveBeenCalledExactlyOnceWith('mielk-check-package: publint is not installed.');
    });

    it('prints a thrown value that is not an Error', () => {
        const log = { error: vi.fn() };
        expect(
            runCommand(
                'cmd',
                () => {
                    // eslint-disable-next-line @typescript-eslint/only-throw-error -- the case under test
                    throw 'text';
                },
                log,
            ),
        ).toBe(1);
        expect(log.error).toHaveBeenCalledExactlyOnceWith('cmd: text');
    });
});
