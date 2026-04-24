'use client';

import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent, Node, mergeAttributes } from '@tiptap/react';
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { Bold } from '@tiptap/extension-bold';
import { Italic } from '@tiptap/extension-italic';
import { Underline } from '@tiptap/extension-underline';
import { Strike } from '@tiptap/extension-strike';
import { History } from '@tiptap/extension-history';
import { TableKitPlus } from 'tiptap-table-plus';
import { BulletList } from '@tiptap/extension-bullet-list';
import { OrderedList } from '@tiptap/extension-ordered-list';
import { ListItem } from '@tiptap/extension-list-item';
import { Blockquote } from '@tiptap/extension-blockquote';
import { Link } from '@tiptap/extension-link';
import { ImagePlus } from 'tiptap-image-plus'; import { Code } from '@tiptap/extension-code';
import { CodeBlock } from '@tiptap/extension-code-block';
import { PaginationPlus, PAGE_SIZES } from 'tiptap-pagination-plus';
import { MathliveExtension } from './MathliveExtension';
import { cn } from '@/lib/utils';
import * as Popover from '@radix-ui/react-popover';
import {
  Bold as BoldIcon, Italic as ItalicIcon, Underline as UnderlineIcon,
  Heading1, Heading2, List, ListOrdered,
  Table as TableIcon, Sigma, Undo, Redo,
  Image as ImageIcon,
  Printer,
  BetweenVerticalStartIcon,
  BetweenHorizonalStartIcon,
  Trash2,
  ChevronDown,
  Columns2,
  Rows2,
  TableCellsMerge,
  TableCellsSplit,
  Square,
  ArrowRight,
  ArrowLeft,
  Wrench,
  Grid2X2
} from 'lucide-react';

const HeadingOne = Node.create({
  name: 'headingOne', group: 'block', content: 'inline*',
  parseHTML() { return [{ tag: 'h1' }] },
  renderHTML({ HTMLAttributes }) { return ['h1', mergeAttributes(HTMLAttributes, { style: 'font-size: 40px; font-weight: 800; color: black; display: block; margin: 0.5em 0;' }), 0] },
  addCommands() { return { toggleHeadingOne: () => ({ commands }: any) => commands.toggleNode(this.name, 'paragraph') } }
});

const HeadingTwo = Node.create({
  name: 'headingTwo', group: 'block', content: 'inline*',
  parseHTML() { return [{ tag: 'h2' }] },
  renderHTML({ HTMLAttributes }) { return ['h2', mergeAttributes(HTMLAttributes, { style: 'font-size: 30px; font-weight: 700; color: black; display: block; margin: 0.4em 0;' }), 0] },
  addCommands() { return { toggleHeadingTwo: () => ({ commands }: any) => commands.toggleNode(this.name, 'paragraph') } }
});

interface MenuButtonProps {
  onClick?: () => void;
  isActive?: boolean;
  children: React.ReactNode;
  title?: string;
  className?: string;
  preventDefault?: boolean;
}

const MenuButton = ({
  onClick,
  isActive = false,
  children,
  title,
  className,
  preventDefault = true,
}: MenuButtonProps) => (
  <button
    type="button"
    onClick={(e) => {
      if (preventDefault) e.preventDefault();
      onClick?.();
    }}
    title={title}
    className={cn(
      "p-2 rounded-md transition-all flex items-center justify-center shrink-0 min-w-[36px] min-h-[36px]",
      isActive ? "bg-blue-600 text-white shadow-md" : "hover:bg-gray-100 text-gray-700",
      className
    )}
  >
    {children}
  </button>
);

export default function TiptapEditor() {
  const [showTableMenu, setShowTableMenu] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Document, Paragraph, Text, History, Bold, Italic, Underline, Strike, BulletList, OrderedList, ListItem, Blockquote, Code, CodeBlock,
      Link.configure({ openOnClick: false }),
      TableKitPlus.configure(),
      MathliveExtension, HeadingOne, HeadingTwo,
      ImagePlus.configure({
        // Optional: custom options
        wrapperStyle: { cursor: 'pointer' },
        containerStyle: {
          background: "linear-gradient(90deg,rgba(30, 88, 117, 1) 0%, rgba(87, 199, 133, 1) 50%, rgba(237, 221, 83, 1) 100%)",
          padding: "25px",
          borderRadius: "10px",
        },
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
    ],
    content: `<h1>Stable Custom H1</h1><p>This editor is now print-optimized.</p>`,
  });

  const [, setUpdate] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const h = () => setUpdate(s => s + 1);
    editor.on('transaction', h);
    return () => { editor.off('transaction', h); };
  }, [editor]);

  if (!editor) return null;


const tableActions = [
  { label: 'Col Before', icon: <BetweenVerticalStartIcon size={16} />, onClick: () => editor.chain().focus().addColumnBefore().run() },
  { label: 'Col After', icon: <BetweenVerticalStartIcon size={16} className="rotate-180" />, onClick: () => editor.chain().focus().addColumnAfter().run() },
  { label: 'Del Col', icon: <Trash2 size={16} />, onClick: () => editor.chain().focus().deleteColumn().run() },
  { label: 'Row Before', icon: <BetweenHorizonalStartIcon size={16} />, onClick: () => editor.chain().focus().addRowBefore().run() },
  { label: 'Row After', icon: <BetweenHorizonalStartIcon size={16} className="rotate-180" />, onClick: () => editor.chain().focus().addRowAfter().run() },
  { label: 'Del Row', icon: <Trash2 size={16} />, onClick: () => editor.chain().focus().deleteRow().run() },
  { label: 'Merge', icon: <TableCellsMerge size={16} />, onClick: () => editor.chain().focus().mergeCells().run() },
  { label: 'Split', icon: <TableCellsSplit size={16} />, onClick: () => editor.chain().focus().splitCell().run() },
  { label: 'H-Row', icon: <Rows2 size={16} />, onClick: () => editor.chain().focus().toggleHeaderRow().run() },
  { label: 'H-Col', icon: <Columns2 size={16} />, onClick: () => editor.chain().focus().toggleHeaderColumn().run() },
  { label: 'H-Cell', icon: <Square size={16} />, onClick: () => editor.chain().focus().toggleHeaderCell().run() },
  { label: 'M/S', icon: <TableCellsMerge size={16} />, onClick: () => editor.chain().focus().mergeOrSplit().run() },
  { label: 'Colspan 2', icon: <Grid2X2 size={16} />, onClick: () => editor.chain().focus().setCellAttribute('colspan', 2).run() },
  { label: 'Fix', icon: <Wrench size={16} />, onClick: () => editor.chain().focus().fixTables().run() },
  { label: 'Prev', icon: <ArrowLeft size={16} />, onClick: () => editor.chain().focus().goToPreviousCell().run() },
  { label: 'Next', icon: <ArrowRight size={16} />, onClick: () => editor.chain().focus().goToNextCell().run() },
  { label: 'Del Table', icon: <Trash2 size={16} className="text-red-500" />, onClick: () => editor.chain().focus().deleteTable().run() },
];

return (
  <div className="flex flex-col h-screen bg-[#f5f5f7] overflow-hidden" data-theme="light">
    <style dangerouslySetInnerHTML={{
      __html: `
      .tiptap-page { 
...
          background-color: #ffffff !important; 
          color: black !important; 
          box-shadow: 0 10px 30px rgba(0,0,0,0.08) !important; 
          margin-bottom: 40px !important; 
          padding: 2cm !important; 
          min-height: 29.7cm !important; 
          box-sizing: border-box !important; 
        }

        /* PRINT CONFIGURATION */
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          
          body, html, #__next, main {
            background: white !important;
            height: auto !important;
            overflow: visible !important;
          }

          .no-print {
            display: none !important;
          }

          .tiptap-page-container {
            background: white !important;
            height: auto !important;
            overflow: visible !important;
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
            page-break-after: always !important;
            border: none !important;
          }

          /* Ensure black text and visible borders on print */
          h1, h2, p, td, th, .tiptap-page * {
            color: black !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          table {
            border: 1px solid black !important;
          }
        }
      `}} />

      <div className="flex-none  w-full bg-white border-b p-1.5 pl-[60px] flex items-center gap-1 overflow-x-auto no-scrollbar shadow-sm z-50 no-print">
        <MenuButton onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo size={18} /></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo size={18} /></MenuButton>
        <div className="w-[1px] h-6 bg-gray-200 mx-1 shrink-0" />

        <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold"><BoldIcon size={18} /></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic"><ItalicIcon size={18} /></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline"><UnderlineIcon size={18} /></MenuButton>

        <div className="w-[1px] h-6 bg-gray-200 mx-1 shrink-0" />

        <MenuButton onClick={() => (editor.chain().focus() as any).toggleHeadingOne().run()} isActive={editor.isActive('headingOne')} title="H1"><Heading1 size={18} /></MenuButton>
        <MenuButton onClick={() => (editor.chain().focus() as any).toggleHeadingTwo().run()} isActive={editor.isActive('headingTwo')} title="H2"><Heading2 size={18} /></MenuButton>

        <div className="w-[1px] h-6 bg-gray-200 mx-1 shrink-0" />

        <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List"><List size={18} /></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Ordered List"><ListOrdered size={18} /></MenuButton>
        <MenuButton onClick={() => {
          const url = window.prompt("URL");
          if (url) {
            editor.chain().focus().setImage({ src: url }).run();
          }
        }} isActive={editor.isActive('imagePlus')} title="Image"><ImageIcon size={18} /></MenuButton>
          {editor.isActive("imagePlus") && <MenuButton onClick={() => editor.chain().focus().deleteSelection().run()} title="Trash"><Trash2 size={18} /></MenuButton>}
        
        <Popover.Root open={showTableMenu} onOpenChange={setShowTableMenu}>
          <Popover.Trigger asChild>
            <div className="relative">
              <MenuButton 
                preventDefault={false}
                isActive={showTableMenu || editor.isActive('table')} 
                title="Table Operations"
              >
                <TableIcon size={18} />
                <ChevronDown size={14} className={cn("ml-1 transition-transform", showTableMenu && "rotate-180")} />
              </MenuButton>
            </div>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content sideOffset={5} side="bottom" align="start" className="bg-white border rounded-md shadow-xl p-3 z-[100] grid grid-cols-3 gap-2 min-w-[320px] animate-in fade-in zoom-in duration-200">
              {tableActions.map((action, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.preventDefault();
                    action.onClick();
                    setShowTableMenu(false);
                  }}
                  className="flex flex-col items-center justify-center p-2 hover:bg-gray-50 rounded-lg text-[10px] text-gray-600 hover:text-blue-600 gap-1.5 transition-all border border-transparent hover:border-blue-100 group"
                >
                  <div className="p-1.5 bg-gray-50 rounded group-hover:bg-blue-50 transition-colors">
                    {action.icon}
                  </div>
                  <span className="text-center font-medium leading-tight">{action.label}</span>
                </button>
              ))}
              <div className="col-span-3 border-t mt-1 pt-2">
                 <button
                  onClick={(e) => {
                    e.preventDefault();
                    editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run();
                    setShowTableMenu(false);
                  }}
                  className="w-full flex items-center justify-center p-2.5 hover:bg-blue-50 rounded-lg text-xs font-bold text-blue-600 gap-2 transition-colors border border-dashed border-blue-200"
                >
                  <Grid2X2 size={16} /> Insert 3x3 Table
                </button>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      
        <button
          onClick={() => editor.chain().focus().insertMath().run()}
          className="ml-2 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5 px-3 shadow-sm shrink-0"
        >
          <Sigma size={18} /> <span className="text-sm font-bold">Math</span>
        </button>

        <div className="flex-1" />

        <button
          onClick={() => window.print()}
          className="p-2 bg-gray-800 text-white rounded-md hover:bg-black flex items-center gap-1.5 px-3 shadow-sm shrink-0 ml-4"
        >
          <Printer size={18} /> <span className="text-sm font-bold">Print</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-10 flex flex-col items-center tiptap-page-container">
        <div className="w-full max-w-[21cm]">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    headingOne: { toggleHeadingOne: () => ReturnType; }
    headingTwo: { toggleHeadingTwo: () => ReturnType; }
  }
}
