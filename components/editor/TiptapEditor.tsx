'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { ImagePlus } from 'tiptap-image-plus';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { TextAlign } from '@tiptap/extension-text-align';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from '@tiptap/extension-placeholder';
import { PaginationPlus } from "tiptap-pagination-plus";

import { MathliveExtension } from './plugins/MathliveExtension';
import { ChartExtension } from './plugins/ChartExtension';
import { SlashCommands } from './plugins/SlashCommands';
import { EditorToolbar } from './EditorToolbar';
import { VerticalToolbar } from './VerticalToolbar';
import { CollaborationExtension } from './plugins/CollaborationExtension';
import { CollaborationCaretExtension } from './plugins/CollaborationCaretExtension';

import {
  DEFAULT_PAGE_SETTINGS,
  mmToPx,
  normalizePageSettings,
  pageSettingsToPluginConfig,
  type PageSettings,
} from '@/lib/pageSize';
import { exportDocument } from '@/lib/export';

import { useEditorImages } from './hooks/useEditorImages';
import { useEditorStorage } from './hooks/useEditorStorage';
import { useEditorActions } from './hooks/useEditorActions';
import { useCollaboration, CollaborationConfig } from './hooks/useCollaboration';
import { useD1DocumentSync, D1SyncTarget, DocSyncState } from './hooks/useD1DocumentSync';

import 'katex/dist/katex.min.css';

export default function TiptapEditor({
  initialContent,
  onContentChange,
  collaboration,
  d1Sync,
  readOnly,
  onSyncChange,
  saveRequestId,
  pageSettings,
  onPageSettingsChange,
  documentName,
}: {
  initialContent?: string,
  onContentChange?: (html: string) => void,
  collaboration?: CollaborationConfig | null,
  d1Sync?: D1SyncTarget | null,
  readOnly?: boolean,
  onSyncChange?: (state: DocSyncState) => void,
  saveRequestId?: number,
  /** Sheet size, orientation and margins. */
  pageSettings?: PageSettings,
  /** Called whenever the user changes the sheet. */
  onPageSettingsChange?: (settings: PageSettings) => void,
  /** Name of the document, used for the exported files. */
  documentName?: string,
}) {
  const collab = useCollaboration(collaboration);
  const isCollaborating = !!collab;
  const { syncState, saveNow } = useD1DocumentSync(
    collab,
    !readOnly && isCollaborating ? (d1Sync ?? null) : null,
  );

  // Report save status upward (deduplicated so the parent never loops).
  const lastReported = useRef<string>("");
  useEffect(() => {
    const key = `${syncState.status}|${syncState.lastSavedAt ?? ""}`;
    if (lastReported.current !== key) {
      lastReported.current = key;
      onSyncChange?.(syncState);
    }
  }, [syncState, onSyncChange]);

  // Manual Save button in the page header increments `saveRequestId`.
  const lastSaveRequest = useRef(saveRequestId);
  useEffect(() => {
    if (saveRequestId !== undefined && saveRequestId !== lastSaveRequest.current) {
      lastSaveRequest.current = saveRequestId;
      saveNow();
    }
  }, [saveRequestId, saveNow]);

  // The sheet the document is laid out on. Persisted on the document, so it
  // survives a reload and applies to every tab.
  const settings = useMemo(
    () => normalizePageSettings(pageSettings ?? DEFAULT_PAGE_SETTINGS),
    [pageSettings],
  );

  const extensions = useMemo(() => {
    const pageConfig = pageSettingsToPluginConfig(settings);
    const base = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      // Yjs brings its own undo/redo (via yUndoPlugin); disable the native history.
      undoRedo: isCollaborating ? false : undefined,
    }),
    TextStyleKit,
    Subscript,
    Superscript,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TableKit.configure({
      table: {
        resizable: true,
        handleWidth: 5,
        cellMinWidth: 50,
      },
    }),
    MathliveExtension,
    ChartExtension,
    SlashCommands,
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') {
          return `Heading ${node.attrs.level}`;
        }
        return 'Type / to open command plate';
      },
      showOnlyWhenEditable: true,
      includeChildren: true,

    }),
    ImagePlus.configure({
      wrapperStyle: { cursor: 'pointer' },
      containerStyle: { padding: "25px", borderRadius: "10px" },
    }),
    PaginationPlus.configure({
      pageHeight: pageConfig.pageHeight,
      pageWidth: pageConfig.pageWidth,
      pageGap: 20,
      pageBreakBackground: "var(--bg-app)",
      marginTop: pageConfig.marginTop,
      marginBottom: pageConfig.marginBottom,
      marginLeft: pageConfig.marginLeft,
      marginRight: pageConfig.marginRight,
      contentMarginTop: pageConfig.contentMarginTop,
      contentMarginBottom: pageConfig.contentMarginBottom,
    }),
    ];

    if (collab) {
      base.push(
        CollaborationExtension.configure({
          document: collab.ydoc,
          field: 'default',
        }),
        CollaborationCaretExtension.configure({
          provider: collab.provider,
          user: collab.user,
        }),
      );
    }

    return base;
    // The sheet is deliberately not a dependency: changing it must not
    // recreate the editor. The effect below applies it to the running
    // pagination plugin instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collab, isCollaborating]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions,
    // When collaborating, content comes from the shared Yjs doc, so we don't
    // seed it here — the ySyncPlugin binding renders the shared fragment.
    content: isCollaborating ? undefined : initialContent || "<p></p>",
    // `collab` arrives via state (created in an effect), so the editor must be
    // re-created when it changes — setOptions() alone cannot install the
    // collaboration ProseMirror plugins into a running editor.
  }, [collab, isCollaborating]);

  // Seed the shared document with initial content only if it's empty (e.g. the
  // very first collaborator opening a brand-new room). Waits until the initial
  // Yjs sync has finished AND the ProseMirror view has mounted (so plugin views
  // exist) to avoid clobbering content another collaborator already published.
  useEffect(() => {
    if (!isCollaborating || !collab || !initialContent || !editor) return;

    let cancelled = false;
    const fragment = collab.ydoc.getXmlFragment('default');

    const seedIfEmpty = () => {
      if (cancelled) return;
      if (fragment.length === 0) {
        editor.commands.setContent(initialContent);
      }
    };
    // Defer to the next frame so the ProseMirror view (and its plugin views)
    // are attached before we dispatch a transaction.
    const seedAfterRender = () => requestAnimationFrame(seedIfEmpty);

    if (collab.provider.synced) {
      const raf = seedAfterRender();
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    }

    const onSync = (synced: boolean) => {
      if (synced) {
        collab.provider.off('sync', onSync);
        seedAfterRender();
      }
    };
    collab.provider.on('sync', onSync);
    return () => {
      cancelled = true;
      collab.provider.off('sync', onSync);
    };
  }, [isCollaborating, collab, initialContent, editor]);

  // Apply the sheet to the running pagination plugin.
  //
  // The plugin keeps its configuration in its storage and recomputes the
  // page layout whenever the storage changes, so updating it and dispatching
  // a transaction is enough — the editor itself never has to be recreated.
  useEffect(() => {
    if (!editor) return;

    const config = pageSettingsToPluginConfig(settings);

    editor.commands.updatePageSize({
      pageHeight: config.pageHeight,
      pageWidth: config.pageWidth,
      marginTop: config.marginTop,
      marginBottom: config.marginBottom,
      marginLeft: config.marginLeft,
      marginRight: config.marginRight,
    });
    editor.commands.updateContentMargins({
      top: config.contentMarginTop,
      bottom: config.contentMarginBottom,
    });

    // Nudge the plugin so it re-lays out the pages. The transaction is kept
    // out of the undo history — resizing the sheet is not a content edit.
    editor.view.dispatch(editor.state.tr.setMeta('addToHistory', false));
  }, [editor, settings]);

  const { savedImages, addStoredImage, clearStoredImages } = useEditorImages();

  // A small development-only handle so the export pipeline can be driven from
  // the browser console (and from the end-to-end tests).
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !editor) return;
    (window as unknown as { __leaf?: unknown }).__leaf = {
      editor,
      pageSettings: settings,
      exportDocument,
    };
  }, [editor, settings]);
  useEditorStorage(editor, isCollaborating ? undefined : initialContent, onContentChange);
  const {
    showHtmlView,
    htmlOutput,
    setHtmlOutput,
    htmlDirty,
    setHtmlDirty,
    insertImageFromUrl,
    insertStoredImage,
    onUploadImage,
    handleToggleHtmlView,
    handlePrintClick,
  } = useEditorActions(editor, addStoredImage, settings);

  if (!editor) return null;

  const pageWidthPx = Math.round(mmToPx(settings.widthMm));

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[var(--bg-app)] overflow-hidden" data-print="true">
       <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          /* The sheet is the page: the page margins are part of the content
             box, so the printed sheet matches the exported file exactly. */
          @page {
            size: ${settings.widthMm}mm ${settings.heightMm}mm;
            margin: 0 !important;
          }
          body * { visibility: hidden !important; }
          #printableArea, #printableArea * { visibility: visible !important; }
          body, html, #__next, main {
            background: white !important;
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          [data-print="true"] {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            display: block !important;
          }
          .no-print { display: none !important; }
          .tiptap-page-container {
            background: white !important;
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #printableArea {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .flex-1 {
            overflow: visible !important;
            padding: 0 !important;
            display: block !important;
          }
          #printableArea .rm-with-pagination {
            box-shadow: none !important;
            border: none !important;
            background: #fff !important;
          }
          #printableArea #pages .rm-pagination-gap {
            height: 0 !important;
            border: 0 !important;
          }
          #printableArea #pages .rm-page-break .breaker {
            break-after: page !important;
            page-break-after: always !important;
          }
          #printableArea #pages .rm-page-break:last-child .breaker {
            break-after: auto !important;
            page-break-after: auto !important;
          }
          h1, h2, p, td, th, #printableArea * {
            color: black !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          table { border: 1px solid black !important; }
        }
      `}} />

      {/* Toolbar: in the flow on mobile (a row under the page nav bar), and a
          floating overlay on desktop — positioned against the editor canvas so
          it never covers the page header. */}
      {!readOnly && (
        <div className="relative z-30 shrink-0 md:pointer-events-none md:absolute md:inset-x-0 md:top-4 md:z-50 md:flex md:justify-center">
          <div className="pointer-events-auto w-full md:w-[calc(100%-2rem)] md:max-w-[1200px]">
            <EditorToolbar
              editor={editor}
              savedImages={savedImages}
              showHtmlView={showHtmlView}
              htmlDirty={htmlDirty}
              onInsertImageFromUrl={insertImageFromUrl}
              onInsertStoredImage={insertStoredImage}
              onClearStoredImages={clearStoredImages}
              onUploadImage={onUploadImage}
              onToggleHtmlView={handleToggleHtmlView}
              onPrint={handlePrintClick}
              pageSettings={settings}
              onPageSettingsChange={onPageSettingsChange}
              documentName={documentName ?? 'document'}
            />
          </div>
        </div>
      )}
      {!readOnly && <VerticalToolbar editor={editor} />}

      <div id="printableArea" className="tiptap-page-container flex min-h-0 flex-1 flex-col items-center overflow-y-auto no-scrollbar p-3 md:p-10 md:pt-24">
        <div className="w-full" style={{ maxWidth: `${pageWidthPx}px` }}>
          {showHtmlView ? (
            <textarea
              value={htmlOutput}
              onChange={(event) => {
                setHtmlOutput(event.target.value);
                setHtmlDirty(true);
              }}
              className="w-full h-[72vh] bg-[var(--bg-input)] text-[var(--fg-input)] rounded-xl border border-[var(--border-input)] p-4 text-sm leading-6 font-mono shadow-lg outline-none"
            />
          ) : (
            <EditorContent editor={editor} />
          )}
        </div>
      </div>
    </div>
  );
}
