// Shared entry of the package commands (src/bin/*). An error thrown by a command is an expected failure of the check
// or of the release step (e.g. publint not installed, no Unreleased section), so the command prints its message and
// ends with exit code 1 instead of the stack trace printed by Node.js for an uncaught error.

/**
 * Runs the logic of a command and turns a thrown error into a one-line message.
 *
 * @param name Name of the command shown before the message, e.g. `mielk-check-package`.
 * @param main Logic of the command; returns its exit code.
 * @param log Receives the error message; default `console`.
 * @returns Exit code of `main`, or 1 when it throws.
 */
export const runCommand = (name: string, main: () => number, log: Pick<Console, 'error'> = console): number => {
    try {
        return main();
    } catch (error) {
        log.error(`${name}: ${error instanceof Error ? error.message : String(error)}`);
        return 1;
    }
};
