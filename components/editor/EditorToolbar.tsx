'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { cn } from '@/lib/utils';
import * as Popover from '@radix-ui/react-popover';
import {
  Heading3, Table as TableIcon, Sigma, Undo, Redo,
  Image as ImageIcon, Printer, FileCode2,
  BetweenVerticalStartIcon, BetweenHorizonalStartIcon,
  Trash2, ChevronDown, Link2, Upload, Columns2, Rows2,
  TableCellsMerge, TableCellsSplit, Square, ArrowRight, ArrowLeft,
  Wrench, Grid2X2, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  BarChart3,
  Code,
  CodeXml,
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Quote as QuoteIcon, Heading, MoreHorizontal,
  FileDown, FileCog,
} from 'lucide-react';
import { useIsMobile } from '@/lib/useMediaQuery';
import { describePageSize, type PageSettings } from '@/lib/pageSize';
import { PageSetupPanel } from './PageSetupPanel';
import { ExportMenu } from './ExportMenu';

interface MenuButtonProps {
  onClick?: () => void;
  isActive?: boolean;
  children: React.ReactNode;
  title?: string;
  className?: string;
  preventDefault?: boolean;
  [key: string]: unknown;
}

const MenuButton = ({ onClick, isActive = false, children, title, className, preventDefault = true, ...rest }: MenuButtonProps) => (
  <button
    type="button"
    // Extra props are forwarded so the button can be used directly as a
    // Radix `Popover.Trigger` (which injects onPointerDown / aria-expanded).
    {...rest}
    onClick={(e) => { if (preventDefault) e.preventDefault(); onClick?.(); }}
    title={title}
    aria-label={title}
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
  onInsertImageFromUrl: (url: string) => void;
  onInsertStoredImage: (src: string) => void;
  onClearStoredImages: () => void;
  onUploadImage: React.ChangeEventHandler<HTMLInputElement>;
  onToggleHtmlView: () => void;
  onPrint: () => void;
  /** Sheet size, orientation and margins. */
  pageSettings: PageSettings;
  /** Called when the user changes the sheet. */
  onPageSettingsChange?: (settings: PageSettings) => void;
  /** Name used for the exported files. */
  documentName: string;
}

const FONT_SIZES = ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '24pt', '30pt', '36pt', '48pt', '60pt', '72pt'];

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

/** Compact button metrics for the phone toolbar. */
const MOBILE_BTN = 'min-w-[34px] min-h-[34px] p-1.5';

/* ------------------------------------------------------------------ */
/*  Shared pieces — rendered either inside a Radix popover (desktop)   */
/*  or inside the mobile "More tools" sheet, so both stay in sync.     */
/* ------------------------------------------------------------------ */

function FontSizeOptions({ editor, wrap = false }: { editor: Editor; wrap?: boolean }) {
  return (
    <div className={cn('flex gap-1', wrap ? 'flex-wrap' : 'flex-col')}>
      {FONT_SIZES.map((size) => (
        <button
          key={size}
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().setMark('textStyle', { fontSize: size }).run();
          }}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            editor.getAttributes('textStyle').fontSize === size
              ? "bg-[var(--bg-toolbar-active)] text-[var(--fg-toolbar-active)]"
              : "text-[var(--fg-popover)] hover:bg-[var(--bg-toolbar-hover)]"
          )}
        >
          {size.replace('pt', '')}
        </button>
      ))}
    </div>
  );
}

function ImageTools({
  savedImages,
  imageUrl,
  onImageUrlChange,
  onInsertImageFromUrl,
  onInsertStoredImage,
  onClearStoredImages,
  onUploadImage,
  fileInputRef,
}: {
  savedImages: StoredImage[];
  imageUrl: string;
  onImageUrlChange: (value: string) => void;
  onInsertImageFromUrl: (url: string) => void;
  onInsertStoredImage: (src: string) => void;
  onClearStoredImages: () => void;
  onUploadImage: React.ChangeEventHandler<HTMLInputElement>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-[var(--fg-popover)]">Insert by URL</div>
        <div className="flex gap-2">
          <input
            type="url"
            value={imageUrl}
            placeholder="https://example.com/image.png"
            onChange={(e) => onImageUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onInsertImageFromUrl(imageUrl);
                onImageUrlChange('');
              }
            }}
            className="flex-1 h-9 min-w-0 px-2.5 bg-[var(--bg-input)] text-[var(--fg-input)] border border-[var(--border-input)] rounded-md text-xs outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            onClick={() => { onInsertImageFromUrl(imageUrl); onImageUrlChange(''); }}
            className="h-9 shrink-0 px-3 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 inline-flex items-center gap-1.5"
          >
            <Link2 size={14} /> Add
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-[var(--fg-popover)]">Upload from device</div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onUploadImage}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-9 px-3 rounded-md border border-dashed border-blue-300 text-blue-700 text-xs font-semibold hover:bg-blue-50 inline-flex items-center justify-center gap-2"
        >
          <Upload size={14} /> Choose image
        </button>
      </div>

      {savedImages.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-[var(--fg-popover)]">Saved uploads</div>
            <button onClick={onClearStoredImages} className="text-[11px] text-red-600 hover:text-red-700 font-medium">
              Clear
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto">
            {savedImages.map((image) => (
              <button
                key={image.id}
                onClick={() => onInsertStoredImage(image.src)}
                className="h-16 border border-[var(--border-popover)] rounded-md overflow-hidden hover:border-blue-400"
                title="Insert saved image"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.src} alt="Saved upload" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface TableAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

function TableTools({
  tableActions,
  onInsertTable,
}: {
  tableActions: TableAction[];
  onInsertTable: () => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {tableActions.map((action, i) => (
        <button
          key={i}
          onClick={(e) => { e.preventDefault(); action.onClick(); }}
          className="flex flex-col items-center justify-center p-2 hover:bg-[var(--bg-toolbar-hover)] rounded-lg text-[10px] text-[var(--fg-popover)] hover:text-blue-600 gap-1.5 transition-all border border-transparent hover:border-blue-100 group"
        >
          <div className="p-1.5 bg-[var(--bg-toolbar-hover)] rounded group-hover:bg-blue-50 transition-colors">{action.icon}</div>
          <span className="text-center font-medium leading-tight">{action.label}</span>
        </button>
      ))}
      <div className="col-span-3 border-t border-[var(--border-popover)] mt-1 pt-2">
        <button
          onClick={(e) => { e.preventDefault(); onInsertTable(); }}
          className="w-full flex items-center justify-center p-2.5 hover:bg-blue-50 rounded-lg text-xs font-bold text-blue-600 gap-2 transition-colors border border-dashed border-blue-200"
        >
          <Grid2X2 size={16} /> Insert 3x3 Table
        </button>
      </div>
    </div>
  );
}

/** Heading picker. Rendered as a portalled popover so it is not clipped by the
 *  horizontally scrollable toolbar row it lives in. */
function HeadingPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const activeHeading = HEADING_LEVELS.find((level) => editor.isActive('heading', { level }));

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <div className="relative shrink-0">
          <MenuButton preventDefault={false} isActive={open || !!activeHeading} title="Headings" className={MOBILE_BTN}>
            <Heading size={18} strokeWidth={2.5} />
            {activeHeading && (
              <span className="absolute -right-0.5 -top-0.5 bg-blue-600 text-white text-[8px] px-1 rounded-full font-black scale-90">
                {activeHeading}
              </span>
            )}
          </MenuButton>
        </div>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          sideOffset={6}
          align="start"
          collisionPadding={8}
          className="z-[100] grid grid-cols-3 gap-1 rounded-xl border border-[var(--border-popover)] bg-[var(--bg-popover)] p-2 shadow-2xl"
        >
          {HEADING_LEVELS.map((level) => (
            <button
              key={level}
              onClick={(e) => {
                e.preventDefault();
                editor.chain().focus().toggleHeading({ level }).run();
                setOpen(false);
              }}
              className={cn(
                "w-10 h-10 flex items-center justify-center text-sm font-bold rounded-xl transition-all border shrink-0",
                editor.isActive('heading', { level })
                  ? "bg-[var(--bg-toolbar-active)] text-[var(--fg-toolbar-active)] border-[var(--bg-toolbar-active)] shadow-md"
                  : "bg-[var(--bg-toolbar-hover)] text-[var(--fg-popover)] border-transparent hover:bg-[var(--bg-toolbar-active)] hover:text-[var(--fg-toolbar-active)]"
              )}
            >
              H{level}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ------------------------------------------------------------------ */
/*  Main toolbar                                                        */
/* ------------------------------------------------------------------ */

export const EditorToolbar = function EditorToolbar({
  editor,
  savedImages,
  showHtmlView,
  htmlDirty,
  onInsertImageFromUrl,
  onInsertStoredImage,
  onClearStoredImages,
  onUploadImage,
  onToggleHtmlView,
  onPrint,
  pageSettings,
  onPageSettingsChange,
  documentName,
}: EditorToolbarProps) {
  const isMobile = useIsMobile();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);
  const [showImageMenu, setShowImageMenu] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showPageMenu, setShowPageMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
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

  const tableActions: TableAction[] = [
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

  const getActiveAlign = () => {
    // Check headings and paragraphs specifically
    if (editor.isActive('paragraph', { textAlign: 'center' }) || editor.isActive('heading', { textAlign: 'center' })) return 'center';
    if (editor.isActive('paragraph', { textAlign: 'right' }) || editor.isActive('heading', { textAlign: 'right' })) return 'right';
    if (editor.isActive('paragraph', { textAlign: 'justify' }) || editor.isActive('heading', { textAlign: 'justify' })) return 'justify';
    return 'left';
  };

  const activeAlign = getActiveAlign();

  const insertTable = () => editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run();

  /* ---------------------------- desktop ---------------------------- */

  const desktopToolbar = (
    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
      <MenuButton onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z / Cmd+Z)"><Undo size={18} /></MenuButton>
      <MenuButton onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Shift+Z / Cmd+Shift+Z)"><Redo size={18} /></MenuButton>
      <div className="w-[1px] h-6 bg-[var(--border-toolbar)] mx-1 shrink-0" />

      <MenuButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={activeAlign === 'left'}
        title="Align Left (Ctrl+Shift+L / Cmd+Shift+L)"
      >
        <AlignLeft size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={activeAlign === 'center'}
        title="Align Center (Ctrl+Shift+E / Cmd+Shift+E)"
      >
        <AlignCenter size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={activeAlign === 'right'}
        title="Align Right (Ctrl+Shift+R / Cmd+Shift+R)"
      >
        <AlignRight size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        isActive={activeAlign === 'justify'}
        title="Justify (Ctrl+Shift+J / Cmd+Shift+J)"
      >
        <AlignJustify size={18} />
      </MenuButton>
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
            <FontSizeOptions editor={editor} />
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
          <Popover.Content sideOffset={5} side="bottom" align="start" collisionPadding={8} className="bg-[var(--bg-popover)] border border-[var(--border-popover)] rounded-md shadow-xl p-3 z-[100] w-[min(22.5rem,calc(100vw-1.5rem))] animate-in fade-in zoom-in duration-200 space-y-3">
            <ImageTools
              savedImages={savedImages}
              imageUrl={imageUrl}
              onImageUrlChange={setImageUrl}
              onInsertImageFromUrl={(url) => { onInsertImageFromUrl(url); setImageUrl(''); setShowImageMenu(false); }}
              onInsertStoredImage={(src) => { onInsertStoredImage(src); setShowImageMenu(false); }}
              onClearStoredImages={onClearStoredImages}
              onUploadImage={onUploadImage}
              fileInputRef={fileInputRef}
            />
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
          <Popover.Content sideOffset={5} side="bottom" align="start" collisionPadding={8} className="bg-[var(--bg-popover)] border border-[var(--border-popover)] rounded-md shadow-xl p-3 z-[100] w-[min(22.5rem,calc(100vw-1.5rem))] animate-in fade-in zoom-in duration-200">
            <TableTools tableActions={tableActions} onInsertTable={() => { insertTable(); setShowTableMenu(false); }} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <MenuButton onClick={() => editor.chain().focus().insertMath().run()} title="Insert Equation"><Sigma size={18} /></MenuButton>
      <MenuButton onClick={() => editor.chain().focus().insertChart().run()} title="Insert Chart"><BarChart3 size={18} /></MenuButton>

      <div className="w-[1px] h-6 bg-[var(--border-toolbar)] mx-1 shrink-0" />

      <MenuButton
        onClick={onToggleHtmlView}
        isActive={showHtmlView}
        title={showHtmlView ? "Switch to Editor View" : "Switch to HTML View"}
        className="relative"
      >
        <FileCode2 size={18} />
        {htmlDirty && (
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
        )}
      </MenuButton>

      <div className="w-[1px] h-6 bg-[var(--border-toolbar)] mx-1 shrink-0" />

      <Popover.Root open={showPageMenu} onOpenChange={setShowPageMenu}>
        <Popover.Trigger asChild>
          <div className="relative shrink-0">
            <MenuButton
              preventDefault={false}
              isActive={showPageMenu}
              title="Page size, orientation and margins"
              className="gap-1 px-2"
            >
              <FileCog size={18} />
              <span className="hidden text-xs font-semibold lg:inline">
                {describePageSize(pageSettings).split(' · ')[0]}
              </span>
              <ChevronDown size={13} className={cn("transition-transform", showPageMenu && "rotate-180")} />
            </MenuButton>
          </div>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={6}
            side="bottom"
            align="end"
            collisionPadding={8}
            className="z-[100] max-h-[85vh] overflow-y-auto rounded-xl border border-[var(--border-popover)] bg-[var(--bg-popover)] shadow-2xl animate-in fade-in zoom-in duration-200"
          >
            <PageSetupPanel
              settings={pageSettings}
              onChange={(next) => {
                onPageSettingsChange?.(next);
              }}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <Popover.Root open={showExportMenu} onOpenChange={setShowExportMenu}>
        <Popover.Trigger asChild>
          <div className="relative shrink-0">
            <MenuButton
              preventDefault={false}
              isActive={showExportMenu}
              title="Export to PDF, Word or Google Docs"
              className="gap-1 px-2"
            >
              <FileDown size={18} />
              <span className="hidden text-xs font-semibold lg:inline">Export</span>
              <ChevronDown size={13} className={cn("transition-transform", showExportMenu && "rotate-180")} />
            </MenuButton>
          </div>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={6}
            side="bottom"
            align="end"
            collisionPadding={8}
            className="z-[100] max-h-[85vh] overflow-y-auto rounded-xl border border-[var(--border-popover)] bg-[var(--bg-popover)] shadow-2xl animate-in fade-in zoom-in duration-200"
          >
            <ExportMenu
              editor={editor}
              pageSettings={pageSettings}
              fileName={documentName}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <MenuButton onClick={onPrint} title="Print Document">
        <Printer size={18} />
      </MenuButton>
    </div>
  );

  /* ---------------------------- mobile ----------------------------- */

  const mobileMorePanel = (
    <div className="space-y-4 p-3">
      {/* Alignment */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-popover)] opacity-70">Alignment</div>
        <div className="flex gap-1.5">
          {([
            { key: 'left', icon: <AlignLeft size={18} />, label: 'Align Left' },
            { key: 'center', icon: <AlignCenter size={18} />, label: 'Align Center' },
            { key: 'right', icon: <AlignRight size={18} />, label: 'Align Right' },
            { key: 'justify', icon: <AlignJustify size={18} />, label: 'Justify' },
          ] as const).map((item) => (
            <MenuButton
              key={item.key}
              onClick={() => editor.chain().focus().setTextAlign(item.key).run()}
              isActive={activeAlign === item.key}
              title={item.label}
              className="flex-1 bg-[var(--bg-toolbar-hover)]"
            >
              {item.icon}
            </MenuButton>
          ))}
        </div>
      </div>

      {/* Font size */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-popover)] opacity-70">Font size</div>
        <FontSizeOptions editor={editor} wrap />
      </div>

      {/* Blocks & marks */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-popover)] opacity-70">Blocks</div>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { icon: <Code size={17} />, label: 'Inline code', run: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code') },
            { icon: <CodeXml size={17} />, label: 'Code block', run: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock') },
            { icon: <ListOrdered size={17} />, label: 'Numbered list', run: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
            { icon: <QuoteIcon size={17} />, label: 'Quote', run: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
            { icon: <Sigma size={17} />, label: 'Equation', run: () => editor.chain().focus().insertMath().run(), active: false },
            { icon: <BarChart3 size={17} />, label: 'Chart', run: () => editor.chain().focus().insertChart().run(), active: false },
            { icon: <FileCode2 size={17} />, label: 'HTML view', run: () => { onToggleHtmlView(); setShowMoreMenu(false); }, active: showHtmlView },
            { icon: <Printer size={17} />, label: 'Print', run: () => onPrint(), active: false },
            ...(editor.isActive('image')
              ? [{ icon: <Trash2 size={17} />, label: 'Delete image', run: () => editor.chain().focus().deleteSelection().run(), active: false }]
              : []),
          ].map((item) => (
            <button
              key={item.label}
              onClick={(e) => { e.preventDefault(); item.run(); }}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-[10px] font-medium transition-colors",
                item.active
                  ? "border-transparent bg-[var(--bg-toolbar-active)] text-[var(--fg-toolbar-active)]"
                  : "border-[var(--border-popover)] bg-[var(--bg-toolbar-hover)] text-[var(--fg-popover)]"
              )}
            >
              {item.icon}
              <span className="leading-tight">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Image */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-popover)] opacity-70">Image</div>
        <ImageTools
          savedImages={savedImages}
          imageUrl={imageUrl}
          onImageUrlChange={setImageUrl}
          onInsertImageFromUrl={(url) => { onInsertImageFromUrl(url); setImageUrl(''); setShowMoreMenu(false); }}
          onInsertStoredImage={(src) => { onInsertStoredImage(src); setShowMoreMenu(false); }}
          onClearStoredImages={onClearStoredImages}
          onUploadImage={onUploadImage}
          fileInputRef={fileInputRef}
        />
      </div>

      {/* Table */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-popover)] opacity-70">Table</div>
        <TableTools tableActions={tableActions} onInsertTable={() => { insertTable(); setShowMoreMenu(false); }} />
      </div>

      {/* Page setup */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-popover)] opacity-70">Page setup</div>
        <div className="rounded-xl border border-[var(--border-popover)] bg-[var(--bg-toolbar-hover)]">
          <PageSetupPanel
            settings={pageSettings}
            onChange={(next) => {
              onPageSettingsChange?.(next);
            }}
          />
        </div>
      </div>

      {/* Export */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-popover)] opacity-70">Export</div>
        <div className="rounded-xl border border-[var(--border-popover)] bg-[var(--bg-toolbar-hover)]">
          <ExportMenu
            editor={editor}
            pageSettings={pageSettings}
            fileName={documentName}
          />
        </div>
      </div>
    </div>
  );

  const mobileToolbar = (
    <div className="flex items-center gap-0 overflow-x-auto no-scrollbar">
      {/* Slightly smaller hit targets so the whole primary set fits a phone
          width without horizontal scrolling. */}
      <MenuButton className={MOBILE_BTN} onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z / Cmd+Z)"><Undo size={18} /></MenuButton>
      <MenuButton className={MOBILE_BTN} onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Shift+Z / Cmd+Shift+Z)"><Redo size={18} /></MenuButton>
      <div className="w-px h-6 bg-[var(--border-toolbar)] mx-0.5 shrink-0" />

      <HeadingPicker editor={editor} />

      <MenuButton className={MOBILE_BTN} onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold (Ctrl+B / Cmd+B)"><Bold size={18} /></MenuButton>
      <MenuButton className={MOBILE_BTN} onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic (Ctrl+I / Cmd+I)"><Italic size={18} /></MenuButton>
      <MenuButton className={MOBILE_BTN} onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline (Ctrl+U / Cmd+U)"><Underline size={18} /></MenuButton>
      <MenuButton className={MOBILE_BTN} onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strikethrough (Ctrl+Shift+S / Cmd+Shift+S)"><Strikethrough size={18} /></MenuButton>
      <MenuButton className={MOBILE_BTN} onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List (Ctrl+Shift+8 / Cmd+Shift+8)"><List size={18} /></MenuButton>

      {/* Pinned to the right edge so it stays reachable while the row scrolls. */}
      <div className="sticky right-0 z-10 flex shrink-0 items-center bg-[var(--bg-toolbar)] pl-1.5 shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.35)]">
        <Popover.Root open={showMoreMenu} onOpenChange={setShowMoreMenu}>
          <Popover.Trigger asChild>
            <MenuButton preventDefault={false} isActive={showMoreMenu} title="More tools" className="gap-1 px-2">
              <MoreHorizontal size={18} />
              <span className="text-xs font-semibold">More</span>
            </MenuButton>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              sideOffset={6}
              side="bottom"
              align="end"
              collisionPadding={8}
              className="z-[100] max-h-[70vh] w-[min(24rem,calc(100vw-1rem))] overflow-y-auto rounded-xl border border-[var(--border-popover)] bg-[var(--bg-popover)] shadow-2xl animate-in fade-in zoom-in duration-200"
            >
              {mobileMorePanel}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </div>
  );

  return (
    <div className="relative w-full rounded-2xl border border-[var(--border-toolbar)] bg-[var(--bg-toolbar)]/70 p-1.5 shadow-xl backdrop-blur-md no-print sm:p-2">
      {isMobile ? mobileToolbar : desktopToolbar}
    </div>
  );
};
