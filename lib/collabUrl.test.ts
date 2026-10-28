import { describe, expect, test } from 'bun:test';
import {
  collabBasePath,
  defaultServerUrl,
  normalizeServerUrl,
  toRoomSegment,
} from './collabUrl';

describe('collabUrl', () => {
  test('base path matches the Worker room route', () => {
    // worker/entry.ts mounts the rooms at `${collabBasePath}/:id`.
    expect(collabBasePath).toBe('/collab/rooms');
  });

  test('rooms with slashes and spaces become one stable path segment', () => {
    const segment = toRoomSegment('My Doc/Tab 1');
    expect(segment).not.toContain('/');
    expect(segment).not.toContain(' ');
    expect(segment).toBe(encodeURIComponent('My Doc/Tab 1'));
    // Both collaborators derive the same segment for the same room.
    expect(toRoomSegment('My Doc/Tab 1')).toBe(segment);
  });

  test('http(s) endpoint URLs normalize to ws(s)', () => {
    expect(normalizeServerUrl('https://my-app.workers.dev/collab/rooms')).toBe(
      'wss://my-app.workers.dev/collab/rooms',
    );
    expect(normalizeServerUrl('http://localhost:3001/collab/rooms')).toBe(
      'ws://localhost:3001/collab/rooms',
    );
    expect(normalizeServerUrl('wss://my-app.workers.dev/collab/rooms')).toBe(
      'wss://my-app.workers.dev/collab/rooms',
    );
  });

  test('default URL is same-origin in the browser', () => {
    const w = globalThis as unknown as { window?: unknown };
    const prev = w.window;
    w.window = { location: { protocol: 'https:', host: 'example.com' } };
    try {
      expect(defaultServerUrl()).toBe('wss://example.com/collab/rooms');
    } finally {
      if (prev === undefined) {
        delete w.window;
      } else {
        w.window = prev;
      }
    }
  });

  test('default URL falls back locally without window', () => {
    expect('window' in globalThis).toBe(false);
    expect(defaultServerUrl()).toBe('ws://localhost:1234/collab/rooms');
  });
});
