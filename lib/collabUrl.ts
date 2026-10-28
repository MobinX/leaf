/**
 * Collaboration endpoint URL helpers.
 *
 * The app Worker also serves the Yjs Durable Object, so the editor talks to a
 * same-origin base path. y-websocket appends the room to that base path
 * verbatim, and the Worker routes `/collab/rooms/:id` to one Durable Object
 * per room — therefore the base path must end at `/collab/rooms` and every
 * room must be exactly one URL path segment.
 */

/** Base path served by the Worker for Yjs rooms (no trailing slash). */
export const collabBasePath = '/collab/rooms';

/**
 * Same-origin default: no env var is needed in dev or production because the
 * app Worker serves the rooms itself. Falls back to the local default only
 * where `window` is unavailable.
 */
export function defaultServerUrl(): string {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${collabBasePath}`;
  }
  return `ws://localhost:1234${collabBasePath}`;
}

/**
 * An `http(s)://` endpoint URL works over WebSockets, so normalize the scheme
 * (`https` -> `wss`, `http` -> `ws`). `ws(s)://` URLs pass through unchanged.
 */
export function normalizeServerUrl(url: string): string {
  if (url.startsWith('https://')) {
    return `wss://${url.slice('https://'.length)}`;
  }
  if (url.startsWith('http://')) {
    return `ws://${url.slice('http://'.length)}`;
  }
  return url;
}

/**
 * Encode a room name to a single URL path segment. Document/tab names may
 * contain `/` and spaces; the encoded form keeps them routable and stable so
 * both collaborators derive the same Durable Object id.
 */
export function toRoomSegment(room: string): string {
  return encodeURIComponent(room);
}
