import { useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { CollaborationUser } from '../plugins/CollaborationCaretExtension';

export interface CollaborationConfig {
  /**
   * URL of the y-websocket server, e.g. `ws://localhost:1234`.
   * Defaults to `ws://localhost:1234` when omitted.
   */
  serverUrl?: string;
  /**
   * Room name. Two editors connected to the same server + room share content.
   */
  room?: string;
  /**
   * Display name broadcast to other collaborators.
   */
  userName?: string;
  /**
   * Color used for the cursor / selection (6-digit hex, e.g. `#e6194b`).
   */
  userColor?: string;
}

export interface Collaboration {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  user: CollaborationUser;
}

/**
 * y-websocket passes the server URL straight to `new WebSocket(url)`.
 * A page served over https must connect with wss://, so we normalize the
 * scheme when an http(s) URL is configured.
 */
function normalizeServerUrl(url: string): string {
  if (url.startsWith('https://')) {
    return `wss://${url.slice('https://'.length)}`;
  }
  if (url.startsWith('http://')) {
    return `ws://${url.slice('http://'.length)}`;
  }
  return url;
}

const PALETTE = [
  '#e6194b',
  '#3cb44b',
  '#4363d8',
  '#f58231',
  '#911eb4',
  '#42d4f4',
  '#f032e6',
  '#bfef45',
  '#fabed4',
  '#469990',
];

function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/**
 * Creates a `Y.Doc` + `WebsocketProvider` connecting to a y-websocket server,
 * broadcasts the current user via awareness, and tears everything down when the
 * component unmounts (or when the config changes).
 *
 * Returns `null` when no `room` is provided (collaboration disabled).
 *
 * Note: the provider is created inside an effect with a deferred connect. This
 * is deliberate — React StrictMode (enabled by default in Next.js dev) runs
 * effects as mount → cleanup → mount. If the provider connected immediately on
 * construction, the first (discarded) instance would have its WebSocket closed
 * mid-handshake, surfacing as a "WebSocket is closed before the connection is
 * established" / "connection interrupted while the page was loading" error in
 * the console on every page load.
 */
export function useCollaboration(config?: CollaborationConfig | null): Collaboration | null {
  const serverUrl = normalizeServerUrl(config?.serverUrl?.trim() || 'ws://localhost:1234');
  const room = config?.room?.trim();

  const user = useMemo<CollaborationUser>(
    () => ({
      name: config?.userName?.trim() || 'Guest',
      color: config?.userColor?.trim() || pickColor(config?.userName || 'Guest'),
    }),
    [config?.userName, config?.userColor],
  );

  const collabKey = `${serverUrl}|${room || ''}`;

  const [collab, setCollab] = useState<Collaboration | null>(null);

  useEffect(() => {
    if (!room) {
      // Defer so no state is set synchronously inside the effect body.
      const t = setTimeout(() => setCollab(null), 0);
      return () => clearTimeout(t);
    }

    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(serverUrl, room, ydoc, { connect: false });
    provider.awareness.setLocalStateField('user', user);

    // Defer connecting (and exposing the session to the editor) by a tick:
    // under StrictMode this effect is torn down synchronously right after it
    // runs, so the first (discarded) provider must never have opened a socket.
    const connectTimer = setTimeout(() => {
      provider.connect();
      setCollab({ ydoc, provider, user });
    }, 0);

    return () => {
      clearTimeout(connectTimer);
      provider.destroy();
      ydoc.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collabKey]);

  // Keep the awareness user in sync if it changes without recreating the doc.
  useEffect(() => {
    if (collab) {
      collab.provider.awareness.setLocalStateField('user', user);
    }
  }, [collab, user]);

  return collab;
}
