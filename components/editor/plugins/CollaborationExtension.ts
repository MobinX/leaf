import { Extension } from '@tiptap/core';
import {
  ySyncPlugin,
  yUndoPlugin,
  yUndoPluginKey,
  undo,
  redo,
} from 'y-prosemirror';
import type { Doc, XmlFragment } from 'yjs';

export interface CollaborationOptions {
  /**
   * The Yjs document that holds the shared content.
   */
  document: Doc | null;
  /**
   * The name of the shared Yjs fragment (defaults to "default").
   */
  field: string;
  /**
   * An explicit Yjs fragment. Takes precedence over `document` + `field`.
   */
  fragment: XmlFragment | null;
  /**
   * Fired once when the content from Yjs is initially rendered into ProseMirror.
   * Useful for seeding a brand-new document with initial content.
   */
  onFirstRender?: () => void;
}

/**
 * Custom Yjs collaboration extension.
 *
 * Unlike the official `@tiptap/extension-collaboration` this is built directly on
 * top of the `y-prosemirror` bindings (`ySyncPlugin` + `yUndoPlugin`) so it can be
 * tuned freely. It replaces the editor's native history with the Yjs
 * `UndoManager`, which means undo/redo keeps working across all connected
 * clients (and only tracks *local* user actions, never remote ones).
 */
export const CollaborationExtension = Extension.create<CollaborationOptions>({
  name: 'collaboration',
  priority: 1000,

  addOptions() {
    return {
      document: null,
      field: 'default',
      fragment: null,
      onFirstRender: () => {},
    };
  },

  addCommands() {
    return {
      undo:
        () =>
        ({ tr, state, dispatch }) => {
          tr.setMeta('preventDispatch', true);
          const undoManager = yUndoPluginKey.getState(state)?.undoManager;
          if (!undoManager || undoManager.undoStack.length === 0) {
            return false;
          }
          if (!dispatch) {
            return true;
          }
          return undo(state);
        },
      redo:
        () =>
        ({ tr, state, dispatch }) => {
          tr.setMeta('preventDispatch', true);
          const undoManager = yUndoPluginKey.getState(state)?.undoManager;
          if (!undoManager || undoManager.redoStack.length === 0) {
            return false;
          }
          if (!dispatch) {
            return true;
          }
          return redo(state);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-z': () => this.editor.commands.undo(),
      'Mod-y': () => this.editor.commands.redo(),
      'Shift-Mod-z': () => this.editor.commands.redo(),
    };
  },

  addProseMirrorPlugins() {
    const fragment =
      this.options.fragment ??
      (this.options.document ? this.options.document.getXmlFragment(this.options.field) : null);

    if (!fragment) {
      throw new Error(
        'CollaborationExtension requires a Y.Doc or a Y.XmlFragment to bind to.',
      );
    }

    const yUndoPluginInstance = yUndoPlugin();

    // Keep the Yjs UndoManager alive (and attached) when the ProseMirror view is
    // torn down and re-created — e.g. React StrictMode double-mounting in dev or
    // when the editor is re-instantiated with the same Y.Doc.
    const originalUndoPluginView = yUndoPluginInstance.spec.view as
      | ((view: unknown) => { destroy?: () => void } | void)
      | undefined;

    yUndoPluginInstance.spec.view = (view: unknown) => {
      const state = yUndoPluginKey.getState(view as never);
      const undoManager = state?.undoManager;
      if (!undoManager) {
        return { destroy: () => {} };
      }
      const internal = undoManager as unknown as {
        restore?: () => void;
        trackedOrigins: Set<unknown>;
        _observers: Set<unknown>;
        doc: { on: (event: string, cb: unknown) => void };
        afterTransactionHandler: unknown;
      };

      if (internal.restore) {
        internal.restore();
        internal.restore = () => {};
      }

      const viewRet = originalUndoPluginView ? originalUndoPluginView(view) : undefined;

      return {
        destroy: () => {
          const hasUndoManSelf = internal.trackedOrigins.has(undoManager);
          const observers = internal._observers;
          internal.restore = () => {
            if (hasUndoManSelf) {
              internal.trackedOrigins.add(undoManager);
            }
            internal.doc.on('afterTransaction', internal.afterTransactionHandler);
            internal._observers = observers;
          };
          if (viewRet?.destroy) {
            viewRet.destroy();
          }
        },
      };
    };

    return [
      ySyncPlugin(fragment, {
        onFirstRender: this.options.onFirstRender,
      }),
      yUndoPluginInstance,
    ];
  },
});
