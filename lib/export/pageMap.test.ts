import { describe, expect, test } from 'bun:test';
import { computePageBreakBlocks, type PaginatedPage } from './pageMap';

function page(pageNumber: number, blockIndices: number[]): PaginatedPage {
  return { pageNumber, html: '', blockIndices };
}

describe('computePageBreakBlocks', () => {
  test('a single page has no breaks', () => {
    expect(computePageBreakBlocks([page(1, [0, 1, 2])]).size).toBe(0);
  });

  test('only the first block of the second page breaks', () => {
    const breaks = computePageBreakBlocks([page(1, [0, 1, 2]), page(2, [3, 4, 5])]);
    expect(Array.from(breaks)).toEqual([3]);
  });

  test('a block that spans the break does not count twice', () => {
    // Block 2 is split across the page boundary, so it appears on both pages.
    const breaks = computePageBreakBlocks([page(1, [0, 1, 2]), page(2, [2, 3])]);
    expect(Array.from(breaks)).toEqual([3]);
  });

  test('three pages produce two breaks', () => {
    const breaks = computePageBreakBlocks([
      page(1, [0, 1]),
      page(2, [2, 3]),
      page(3, [4, 5]),
    ]);
    expect(Array.from(breaks)).toEqual([2, 4]);
  });

  test('an empty document has no breaks', () => {
    expect(computePageBreakBlocks([]).size).toBe(0);
  });

  test('a page that repeats earlier blocks adds no break', () => {
    const breaks = computePageBreakBlocks([
      page(1, [0, 1, 2]),
      page(2, [1, 2]),
    ]);
    expect(breaks.size).toBe(0);
  });
});
