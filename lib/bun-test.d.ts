/**
 * Minimal ambient types for `bun:test` so `tsc` passes without the Bun
 * runtime types installed. `bun test` itself provides the real module.
 */
declare module "bun:test" {
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeLessThan(expected: number): void;
    toBeGreaterThan(expected: number): void;
    toBeCloseTo(expected: number, precision?: number): void;
    toContain(item: string): void;
    not: Matchers;
  }
  export function expect(actual: unknown): Matchers;
}
