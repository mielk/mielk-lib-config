import { describe, expect, it } from 'vitest';
import { add, first } from './index.js';

describe('add', () => {
    it('returns the sum of two numbers', () => {
        expect(add(2, 3)).toBe(5);
    });
});

describe('first', () => {
    it('returns the first element', () => {
        expect(first(['a', 'b'])).toBe('a');
    });

    it('returns undefined for an empty list', () => {
        expect(first([])).toBeUndefined();
    });
});
