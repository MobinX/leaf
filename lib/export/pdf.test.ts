import { describe, expect, test } from 'bun:test';
import { computePageBreakBlocks } from './pageMap';
import { assignBlocksToPages } from './pdf';

/**
 * The PDF has to break on exactly the same blocks as the Word file: both
 * exporters are fed the break set computed from the paginated document, so a
 * block that starts page N in the .docx must start page N in the PDF too.
 * These tests pin that contract at the unit level (the builders themselves
 * need a browser DOM, so they are covered by the end-to-end export test).
 */
describe('assignBlocksToPages', () => {
  test('a single page keeps every block together', () => {
    expect(assignBlocksToPages(3, new Set())).toEqual([[0, 1, 2]]);
  });

  test('blocks before the first break stay on page one', () => {
    expect(assignBlocksToPages(6, new Set([3]))).toEqual([
      [0, 1, 2],
      [3, 4, 5],
    ]);
  });

  test('consecutive breaks produce consecutive pages', () => {
    expect(assignBlocksToPages(5, new Set([2, 4]))).toEqual([
      [0, 1],
      [2, 3],
      [4],
    ]);
  });

  test('an empty document yields no pages', () => {
    expect(assignBlocksToPages(0, new Set())).toEqual([]);
  });

  test('a break at block zero still yields a single leading page', () => {
    expect(assignBlocksToPages(2, new Set([0]))).toEqual([[0, 1]]);
  });

  test('out-of-range breaks are ignored', () => {
    expect(assignBlocksToPages(2, new Set([9]))).toEqual([[0, 1]]);
  });

  test('matches computePageBreakBlocks page starts', () => {
    // A block split across the page boundary appears on both Paged.js pages
    // but must not start a new PDF page — mirroring the Word behaviour.
    const pages = [
      { pageNumber: 1, html: '', blockIndices: [0, 1, 2] },
      { pageNumber: 2, html: '', blockIndices: [2, 3, 4] },
      { pageNumber: 3, html: '', blockIndices: [5] },
    ];
    const breaks = computePageBreakBlocks(pages);
    expect(Array.from(breaks)).toEqual([3, 5]);
    expect(assignBlocksToPages(6, breaks)).toEqual([
      [0, 1, 2],
      [3, 4],
      [5],
    ]);
  });
});
