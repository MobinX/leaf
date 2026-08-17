'use client';

import React, { useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { ImagePlus } from 'tiptap-image-plus';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { TextAlign } from '@tiptap/extension-text-align';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from '@tiptap/extension-placeholder';
import { PAGE_SIZES, PaginationPlus } from "tiptap-pagination-plus";

import { MathliveExtension } from './plugins/MathliveExtension';
import { ChartExtension } from './plugins/ChartExtension';
import { SlashCommands } from './plugins/SlashCommands';
import { EditorToolbar } from './EditorToolbar';
import { VerticalToolbar } from './VerticalToolbar';
import { CollaborationExtension } from './plugins/CollaborationExtension';
import { CollaborationCaretExtension } from './plugins/CollaborationCaretExtension';

import { useEditorImages } from './hooks/useEditorImages';
import { useEditorStorage } from './hooks/useEditorStorage';
import { useEditorActions } from './hooks/useEditorActions';
import { useCollaboration, CollaborationConfig } from './hooks/useCollaboration';

import 'katex/dist/katex.min.css';

export default function TiptapEditor({ 
  initialContent, 
  onContentChange,
  collaboration,
}: { 
  initialContent?: string, 
  onContentChange?: (html: string) => void,
  collaboration?: CollaborationConfig | null,
}) {
  const collab = useCollaboration(collaboration);
  const isCollaborating = !!collab;

  const extensions = useMemo(() => {
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
      pageHeight: PAGE_SIZES.A4.pageHeight,
      pageWidth: PAGE_SIZES.A4.pageWidth,
      pageGap: 20,
      pageBreakBackground: "var(--bg-app)",
      marginTop: 20,
      marginBottom: 20,
      marginLeft: 50,
      marginRight: 50,
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
  }, [collab, isCollaborating]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: true,
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

  const { savedImages, addStoredImage, clearStoredImages } = useEditorImages();
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
  } = useEditorActions(editor, addStoredImage);

  if (!editor) return null;

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-app)] overflow-hidden " data-print="true">
       <style dangerouslySetInnerHTML={{
        __html: `
        .tiptap-page { 
          background-color: rgba(255, 255, 255, 0.7) !important; 
          backdrop-filter: blur(8px);
          color: black !important; 
          box-shadow: 0 10px 30px rgba(0,0,0,0.08) !important; 
          margin-bottom: 40px !important; 
          padding: 2cm !important; 
          min-height: 29.7cm !important; 
          box-sizing: border-box !important; 
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
        }

        @media print {
          @page { size: A4; margin: 20px 50px !important; }
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
          .tiptap-page {
            box-shadow: none !important;
            margin: 0 !important;
            border: none !important;
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
          h1, h2, p, td, th, .tiptap-page * {
            color: black !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          table { border: 1px solid black !important; }
        }
      `}} />

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
      />
      <VerticalToolbar editor={editor} />

      <div id="printableArea" className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-10 pt-28 md:pt-20 flex flex-col items-center tiptap-page-container">
        <div className="w-full max-w-[21cm]">
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
