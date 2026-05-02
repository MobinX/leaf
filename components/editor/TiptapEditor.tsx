'use client';

import React, { useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { ImagePlus } from 'tiptap-image-plus';
import { TextAlign } from '@tiptap/extension-text-align';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { TableKit } from "@tiptap/extension-table";
import { PAGE_SIZES, PaginationPlus } from "tiptap-pagination-plus";

import { MathliveExtension } from './plugins/MathliveExtension';
import { ChartExtension } from './plugins/ChartExtension';
import { EditorToolbar } from './EditorToolbar';

import { useEditorImages } from './hooks/useEditorImages';
import { useEditorStorage } from './hooks/useEditorStorage';
import { useEditorActions } from './hooks/useEditorActions';

import 'katex/dist/katex.min.css';

export default function TiptapEditor({ 
  initialContent, 
  onContentChange 
}: { 
  initialContent?: string, 
  onContentChange?: (html: string) => void 
}) {
  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
    }),
    TextStyleKit,
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
    ImagePlus.configure({
      wrapperStyle: { cursor: 'pointer' },
      containerStyle: { padding: "25px", borderRadius: "10px" },
    }),
    PaginationPlus.configure({
      pageHeight: PAGE_SIZES.A4.pageHeight,
      pageWidth: PAGE_SIZES.A4.pageWidth,
      pageGap: 20,
      pageBreakBackground: "#f3f4f6",
      marginTop: 20,
      marginBottom: 20,
      marginLeft: 50,
      marginRight: 50,
    }),
  ], []);

  const editor = useEditor({
    immediatelyRender: false,
    editable: true,
    extensions,
    content: initialContent || `<h1>Stable Custom H1</h1><p>This editor is now print-optimized.</p>`,
  });

  const { savedImages, addStoredImage, clearStoredImages } = useEditorImages();
  useEditorStorage(editor, initialContent, onContentChange);
  const {
    showHtmlView,
    htmlOutput,
    setHtmlOutput,
    htmlDirty,
    setHtmlDirty,
    isPromptCopied,
    insertCoverPage,
    insertImageFromUrl,
    insertStoredImage,
    onUploadImage,
    handleToggleHtmlView,
    handlePrintClick,
    copyLabPrompt
  } = useEditorActions(editor, addStoredImage);

  if (!editor) return null;

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f7] overflow-hidden" data-theme="light">
      <style dangerouslySetInnerHTML={{
        __html: `
        .tiptap-page { 
          background-color: #ffffff !important; 
          color: black !important; 
          box-shadow: 0 10px 30px rgba(0,0,0,0.08) !important; 
          margin-bottom: 40px !important; 
          padding: 2cm !important; 
          min-height: 29.7cm !important; 
          box-sizing: border-box !important; 
        }

        @media print {
          @page { size: A4; margin: 0; }
          body * { visibility: hidden !important; }
          #printableArea, #printableArea * { visibility: visible !important; }
          body, html, #__next, main {
            background: white !important;
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          [data-theme="light"] {
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
        isPromptCopied={isPromptCopied}
        onInsertCoverPage={insertCoverPage}
        onInsertImageFromUrl={insertImageFromUrl}
        onInsertStoredImage={insertStoredImage}
        onClearStoredImages={clearStoredImages}
        onUploadImage={onUploadImage}
        onToggleHtmlView={handleToggleHtmlView}
        onPrint={handlePrintClick}
        onCopyPrompt={copyLabPrompt}
      />

      <div id="printableArea" className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-10 flex flex-col items-center tiptap-page-container">
        <div className="w-full max-w-[21cm]">
          {showHtmlView ? (
            <textarea
              value={htmlOutput}
              onChange={(event) => {
                setHtmlOutput(event.target.value);
                setHtmlDirty(true);
              }}
              className="w-full h-[72vh] bg-[#111827] text-emerald-100 rounded-xl border border-gray-700 p-4 text-sm leading-6 font-mono shadow-lg outline-none"
            />
          ) : (
            <EditorContent editor={editor} />
          )}
        </div>
      </div>
    </div>
  );
}
