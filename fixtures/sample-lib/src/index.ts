/**
 * Adds two numbers.
 *
 * @param a First number.
 * @param b Second number.
 * @returns The sum of `a` and `b`.
 */
export const add = (a: number, b: number): number => a + b;

/**
 * Returns the first element of a list.
 *
 * @param items The list.
 * @returns The first element, or `undefined` for an empty list.
 */
export const first = <T>(items: readonly T[]): T | undefined => items[0];
