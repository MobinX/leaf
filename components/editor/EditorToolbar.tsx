'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { cn } from '@/lib/utils';
import * as Popover from '@radix-ui/react-popover';
import {
  Heading3,
  Table as TableIcon, Sigma, Undo, Redo,
  Image as ImageIcon, Printer, FileCode2,
  BetweenVerticalStartIcon, BetweenHorizonalStartIcon,
  Trash2, ChevronDown, Link2, Upload, Columns2, Rows2,
  TableCellsMerge, TableCellsSplit, Square, ArrowRight, ArrowLeft,
  Wrench, Grid2X2, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  BarChart3, Copy,
  Code,
  CodeXml,
} from 'lucide-react';

interface MenuButtonProps {
  onClick?: () => void;
  isActive?: boolean;
  children: React.ReactNode;
  title?: string;
  className?: string;
  preventDefault?: boolean;
}

const MenuButton = ({ onClick, isActive = false, children, title, className, preventDefault = true }: MenuButtonProps) => (
  <button
    type="button"
    onClick={(e) => { if (preventDefault) e.preventDefault(); onClick?.(); }}
    title={title}
    className={cn(
      "p-2 rounded-md transition-all flex items-center justify-center shrink-0 min-w-[36px] min-h-[36px]",
      isActive 
        ? "bg-[var(--bg-toolbar-active)] text-[var(--fg-toolbar-active)] shadow-md" 
        : "hover:bg-[var(--bg-toolbar-hover)] text-[var(--fg-toolbar)]",
      className
    )}
  >
    {children}
  </button>
);

interface StoredImage { id: string; src: string; createdAt: number };

interface EditorToolbarProps {
  editor: Editor;
  savedImages: StoredImage[];
  showHtmlView: boolean;
  htmlDirty: boolean;
  isPromptCopied: boolean;
  onInsertImageFromUrl: (url: string) => void;
  onInsertStoredImage: (src: string) => void;
  onClearStoredImages: () => void;
  onUploadImage: React.ChangeEventHandler<HTMLInputElement>;
  onToggleHtmlView: () => void;
  onPrint: () => void;
  onCopyPrompt: () => void;
}

export const EditorToolbar = React.memo(function EditorToolbar({
  editor,
  savedImages,
  showHtmlView,
  isPromptCopied,
  onInsertImageFromUrl,
  onInsertStoredImage,
  onClearStoredImages,
  onUploadImage,
  onToggleHtmlView,
  onPrint,
  onCopyPrompt,
}: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [showImageMenu, setShowImageMenu] = useState(false);
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const insertHeadingBeforeCurrentTable = useCallback(() => {
    const { $from } = editor.state.selection;
    let tableDepth = -1;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if ($from.node(depth).type.name === 'table') { tableDepth = depth; break; }
    }
    if (tableDepth === -1) { editor.chain().focus().insertContent({ type: 'heading', attrs: { level: 3 } }).run(); return; }
    editor.chain().focus().insertContentAt($from.before(tableDepth), { type: 'heading', attrs: { level: 3 } }).run();
  }, [editor]);

  const insertHeadingAfterCurrentTable = useCallback(() => {
    const { $from } = editor.state.selection;
    let tableDepth = -1;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if ($from.node(depth).type.name === 'table') { tableDepth = depth; break; }
    }
    if (tableDepth === -1) { editor.chain().focus().insertContent({ type: 'heading', attrs: { level: 3 } }).run(); return; }
    editor.chain().focus().insertContentAt($from.after(tableDepth), { type: 'heading', attrs: { level: 3 } }).run();
  }, [editor]);

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
    { label: 'Insert before table', icon: <Heading3 size={16} />, onClick: insertHeadingBeforeCurrentTable },
    { label: 'Insert after table', icon: <Heading3 size={16} />, onClick: insertHeadingAfterCurrentTable },
    { label: 'Del Table', icon: <Trash2 size={16} className="text-red-500" />, onClick: () => editor.chain().focus().deleteTable().run() },
  ];

  return (
    <div className="flex-none w-full bg-[var(--bg-toolbar)] border-b border-[var(--border-toolbar)] p-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar shadow-sm z-50 no-print">
      <MenuButton onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z / Cmd+Z)"><Undo size={18} /></MenuButton>
      <MenuButton onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Shift+Z / Cmd+Shift+Z)"><Redo size={18} /></MenuButton>
      <div className="w-[1px] h-6 bg-[var(--border-toolbar)] mx-1 shrink-0" />


      <MenuButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Align Left (Ctrl+Shift+L / Cmd+Shift+L)"><AlignLeft size={18} /></MenuButton>
      <MenuButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Align Center (Ctrl+Shift+E / Cmd+Shift+E)"><AlignCenter size={18} /></MenuButton>
      <MenuButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Align Right (Ctrl+Shift+R / Cmd+Shift+R)"><AlignRight size={18} /></MenuButton>
      <MenuButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })} title="Justify (Ctrl+Shift+J / Cmd+Shift+J)"><AlignJustify size={18} /></MenuButton>
      <div className="w-[1px] h-6 bg-[var(--border-toolbar)] mx-1 shrink-0" />

      <Popover.Root open={showFontSizeMenu} onOpenChange={setShowFontSizeMenu}>
        <Popover.Trigger asChild>
          <div className="relative">
            <MenuButton preventDefault={false} isActive={showFontSizeMenu || !!editor.getAttributes('textStyle').fontSize} title="Font Size" className="gap-1 px-2">
              <span className="text-xs font-semibold">{editor.getAttributes('textStyle').fontSize?.replace('pt', '') || '12'}</span>
              <ChevronDown size={14} className={cn("ml-0.5 transition-transform", showFontSizeMenu && "rotate-180")} />
            </MenuButton>
          </div>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content sideOffset={5} side="bottom" align="start" className="bg-[var(--bg-popover)] border border-[var(--border-popover)] rounded-md shadow-xl p-2 z-[100] flex flex-col gap-1 min-w-[80px] max-h-[300px] overflow-y-auto animate-in fade-in zoom-in duration-200">
            {['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '24pt', '30pt', '36pt', '48pt', '60pt', '72pt'].map((size) => (
              <button key={size} onClick={(e) => { e.preventDefault(); editor.chain().focus().setMark('textStyle', { fontSize: size }).run(); setShowFontSizeMenu(false); }}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md text-left transition-colors", 
                  editor.getAttributes('textStyle').fontSize === size 
                    ? "bg-[var(--bg-toolbar-active)] text-[var(--fg-toolbar-active)]" 
                    : "text-[var(--fg-popover)] hover:bg-[var(--bg-toolbar-hover)]")}>
                {size.replace('pt', '')}
              </button>
            ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <MenuButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title="Inline Code (Ctrl+E / Cmd+E)"><Code size={19} /></MenuButton>
      <MenuButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title="Code Block (Ctrl+Alt+C / Cmd+Alt+C)"><CodeXml size={19} /></MenuButton>



      <Popover.Root open={showImageMenu} onOpenChange={setShowImageMenu}>
        <Popover.Trigger asChild>
          <div className="relative">
            <MenuButton preventDefault={false} isActive={showImageMenu || editor.isActive('image')} title="Image">
              <ImageIcon size={18} />
              <ChevronDown size={14} className={cn("ml-1 transition-transform", showImageMenu && "rotate-180")} />
            </MenuButton>
          </div>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content sideOffset={5} side="bottom" align="start" className="bg-[var(--bg-popover)] border border-[var(--border-popover)] rounded-md shadow-xl p-3 z-[100] w-[360px] animate-in fade-in zoom-in duration-200 space-y-3">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-[var(--fg-popover)]">Insert by URL</div>
              <div className="flex gap-2">
                <input type="url" value={imageUrl} placeholder="https://example.com/image.png"
                  onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onInsertImageFromUrl(imageUrl); setImageUrl(''); setShowImageMenu(false); } }}
                  className="flex-1 h-9 px-2.5 bg-[var(--bg-input)] text-[var(--fg-input)] border border-[var(--border-input)] rounded-md text-xs outline-none focus:ring-2 focus:ring-blue-200" />
                <button onClick={() => { onInsertImageFromUrl(imageUrl); setImageUrl(''); setShowImageMenu(false); }}
                  className="h-9 px-3 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 inline-flex items-center gap-1.5">
                  <Link2 size={14} /> Add
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-[var(--fg-popover)]">Upload from device</div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => { onUploadImage(e); setShowImageMenu(false); }} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()}
                className="w-full h-9 px-3 rounded-md border border-dashed border-blue-300 text-blue-700 text-xs font-semibold hover:bg-blue-50 inline-flex items-center justify-center gap-2">
                <Upload size={14} /> Choose image
              </button>
            </div>
            {savedImages.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-[var(--fg-popover)]">Saved uploads</div>
                  <button onClick={onClearStoredImages} className="text-[11px] text-red-600 hover:text-red-700 font-medium">Clear</button>
                </div>
                <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto">
                  {savedImages.map((image) => (
                    <button key={image.id} onClick={() => { onInsertStoredImage(image.src); setShowImageMenu(false); }}
                      className="h-16 border border-[var(--border-popover)] rounded-md overflow-hidden hover:border-blue-400" title="Insert saved image">
                      <img src={image.src} alt="Saved upload" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {editor.isActive("image") && <MenuButton onClick={() => editor.chain().focus().deleteSelection().run()} title="Trash"><Trash2 size={18} /></MenuButton>}

      <Popover.Root open={showTableMenu} onOpenChange={setShowTableMenu}>
        <Popover.Trigger asChild>
          <div className="relative">
            <MenuButton preventDefault={false} isActive={showTableMenu || editor.isActive('table')} title="Table Operations">
              <TableIcon size={18} />
              <ChevronDown size={14} className={cn("ml-1 transition-transform", showTableMenu && "rotate-180")} />
            </MenuButton>
          </div>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content sideOffset={5} side="bottom" align="start" className="bg-[var(--bg-popover)] border border-[var(--border-popover)] rounded-md shadow-xl p-3 z-[100] grid grid-cols-3 gap-2 min-w-[320px] animate-in fade-in zoom-in duration-200">
            {tableActions.map((action, i) => (
              <button key={i} onClick={(e) => { e.preventDefault(); action.onClick(); setShowTableMenu(false); }}
                className="flex flex-col items-center justify-center p-2 hover:bg-[var(--bg-toolbar-hover)] rounded-lg text-[10px] text-[var(--fg-popover)] hover:text-blue-600 gap-1.5 transition-all border border-transparent hover:border-blue-100 group">
                <div className="p-1.5 bg-[var(--bg-toolbar-hover)] rounded group-hover:bg-blue-50 transition-colors">{action.icon}</div>
                <span className="text-center font-medium leading-tight">{action.label}</span>
              </button>
            ))}
            <div className="col-span-3 border-t border-[var(--border-popover)] mt-1 pt-2">
              <button onClick={(e) => { e.preventDefault(); editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run(); setShowTableMenu(false); }}
                className="w-full flex items-center justify-center p-2.5 hover:bg-blue-50 rounded-lg text-xs font-bold text-blue-600 gap-2 transition-colors border border-dashed border-blue-200">
                <Grid2X2 size={16} /> Insert 3x3 Table
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <button onClick={onToggleHtmlView}
        className={cn("ml-2 p-2 rounded-md flex items-center gap-1.5 px-3 shadow-sm shrink-0",
          showHtmlView ? "bg-violet-700 text-white hover:bg-violet-800" : "bg-violet-600 text-white hover:bg-violet-700")}>
        <FileCode2 size={18} />
        <span className="text-sm font-bold">{showHtmlView ? 'Editor' : 'HTML'}</span>
      </button>

      <button onClick={onCopyPrompt}
        className={cn("ml-2 p-2 rounded-md flex items-center gap-1.5 px-3 shadow-sm shrink-0",
          isPromptCopied ? "bg-green-600 text-white hover:bg-green-700" : "bg-amber-600 text-white hover:bg-amber-700")}
        title="Copy lab report prompt">
        <Copy size={18} />
        <span className="text-sm font-bold">{isPromptCopied ? 'Copied' : 'Copy Prompt'}</span>
      </button>

      <button onClick={onPrint} className="p-2 text-white rounded-md flex items-center gap-1.5 px-3 shadow-sm shrink-0 ml-4 bg-gray-800 hover:bg-black">
        <Printer size={18} /> <span className="text-sm font-bold">Print</span>
      </button>

      <button onClick={() => editor.chain().focus().insertMath().run()}
        className="ml-2 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5 px-3 shadow-sm shrink-0">
        <Sigma size={18} /> <span className="text-sm font-bold">Math</span>
      </button>

      <button onClick={() => editor.chain().focus().insertChart().run()}
        className="ml-2 p-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center gap-1.5 px-3 shadow-sm shrink-0">
        <BarChart3 size={18} /> <span className="text-sm font-bold">Chart</span>
      </button>
    </div>
  );
});
