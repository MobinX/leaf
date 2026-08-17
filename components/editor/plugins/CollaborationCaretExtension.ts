import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { yCursorPlugin } from 'y-prosemirror';

export interface CollaborationUser {
  name: string;
  color: string;
}

/**
 * Builds the DOM element shown at each remote user's cursor position.
 *
 * The returned element is placed as a ProseMirror widget at the cursor head.
 * It renders a colored caret with the user's name written in a small label
 * on top of it (positioned via the `.collab-caret` / `.collab-caret-label`
 * CSS classes).
 */
function buildCursor(user: CollaborationUser, clientId: number): HTMLElement {
  const caret = document.createElement('span');
  caret.className = 'collab-caret';
  caret.style.borderColor = user.color;

  const label = document.createElement('span');
  label.className = 'collab-caret-label';
  label.style.backgroundColor = user.color;
  label.textContent = user.name || `User ${clientId}`;

  caret.appendChild(label);
  return caret;
}

/**
 * Renders the highlight shown over a remote user's text selection.
 */
function buildSelection(user: CollaborationUser) {
  return {
    style: `background-color: ${user.color}55`,
    class: 'collab-selection',
  };
}

function awarenessStatesToArray(states: Map<number, { user?: CollaborationUser } | undefined>) {
  return Array.from(states.entries()).map(([clientId, state]) => ({
    clientId,
    ...(state?.user ?? {}),
  }));
}

export interface CollaborationCaretOptions {
  /**
   * The y-websocket provider (its `.awareness` field is used for cursors).
   */
  provider: { awareness: import('y-protocols/awareness').Awareness } | null;
  /**
   * The current user's identity, broadcast to every other connected client.
   */
  user: CollaborationUser;
}

/**
 * Custom remote-cursor extension.
 *
 * Unlike the official `@tiptap/extension-collaboration-caret`, this is built
 * directly on `yCursorPlugin` from `y-prosemirror` with a custom
 * `cursorBuilder` that shows the user's name in a label on top of the caret.
 * It also tracks the list of currently-online users in `editor.storage.users`.
 */
export const CollaborationCaretExtension = Extension.create<CollaborationCaretOptions>({
  name: 'collaborationCaret',
  priority: 999,

  addOptions() {
    return {
      provider: null,
      user: { name: 'Guest', color: '#ffa500' },
    };
  },

  addStorage() {
    return {
      users: [] as Array<{ clientId: number } & Partial<CollaborationUser>>,
    };
  },

  addCommands() {
    return {
      updateUser:
        (attributes: CollaborationUser) =>
        () => {
          this.options.provider?.awareness.setLocalStateField('user', attributes);
          return true;
        },
    } as Partial<import('@tiptap/core').RawCommands>;
  },

  addProseMirrorPlugins() {
    const { provider, user } = this.options;
    if (!provider) {
      throw new Error('CollaborationCaretExtension requires a provider.');
    }

    const awareness = provider.awareness;
    const storage = this.storage;

    // Keeps the awareness "user" state in sync and exposes the online user
    // list through editor.storage.users.
    const awarenessListener = new Plugin({
      key: new PluginKey('collaborationCaretAwareness'),
      view: () => {
        const syncUsers = () => {
          storage.users = awarenessStatesToArray(awareness.states);
        };
        awareness.setLocalStateField('user', user);
        syncUsers();
        awareness.on('update', syncUsers);
        return {
          destroy: () => {
            awareness.off('update', syncUsers);
            storage.users = [];
          },
        };
      },
    });

    return [
      awarenessListener,
      yCursorPlugin(awareness, {
        cursorBuilder: buildCursor,
        selectionBuilder: buildSelection,
      }),
    ];
  },
});
