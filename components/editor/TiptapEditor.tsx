'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, Node, mergeAttributes } from '@tiptap/react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
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
import { ImagePlus } from 'tiptap-image-plus';
import { Code } from '@tiptap/extension-code';
import { CodeBlock } from '@tiptap/extension-code-block';
import { PaginationPlus, PAGE_SIZES } from 'tiptap-pagination-plus';
import { MathliveExtension } from './MathliveExtension';
import { ChartExtension } from './ChartExtension';
import { cn } from '@/lib/utils';
import * as Popover from '@radix-ui/react-popover';
import {
  Bold as BoldIcon, Italic as ItalicIcon, Underline as UnderlineIcon,
  Heading1, Heading2, List, ListOrdered,
  Table as TableIcon, Sigma, Undo, Redo,
  Image as ImageIcon,
  Printer,
  FileCode2,
  BetweenVerticalStartIcon,
  BetweenHorizonalStartIcon,
  Trash2,
  ChevronDown,
  Link2,
  Upload,
  Columns2,
  Rows2,
  TableCellsMerge,
  TableCellsSplit,
  Square,
  ArrowRight,
  ArrowLeft,
  Wrench,
  Grid2X2,
  BarChart3,
} from 'lucide-react';

const HeadingOne = Node.create({
  name: 'headingOne', group: 'block', content: 'inline*',
  parseHTML() { return [{ tag: 'h1' }] },
  renderHTML({ HTMLAttributes }) { return ['h1', mergeAttributes(HTMLAttributes, { style: 'font-size: 40px; font-weight: 800; color: black; display: block; margin: 0.5em 0;' }), 0] },
  addCommands() { return { toggleHeadingOne: () => ({ commands }) => commands.toggleNode(this.name, 'paragraph') } }
});

const HeadingTwo = Node.create({
  name: 'headingTwo', group: 'block', content: 'inline*',
  parseHTML() { return [{ tag: 'h2' }] },
  renderHTML({ HTMLAttributes }) { return ['h2', mergeAttributes(HTMLAttributes, { style: 'font-size: 30px; font-weight: 700; color: black; display: block; margin: 0.4em 0;' }), 0] },
  addCommands() { return { toggleHeadingTwo: () => ({ commands }) => commands.toggleNode(this.name, 'paragraph') } }
});

type StoredImage = {
  id: string;
  src: string;
  createdAt: number;
};

const IMAGE_DB_NAME = 'leaf-editor-images';
const IMAGE_STORE_NAME = 'uploadedImages';
const IMAGE_DB_VERSION = 1;
const MAX_STORED_IMAGES = 12;

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [showImageMenu, setShowImageMenu] = useState(false);
  const [showHtmlView, setShowHtmlView] = useState(false);
  const [htmlOutput, setHtmlOutput] = useState('');
  const [htmlDirty, setHtmlDirty] = useState(false);
  const [isMakingPdf, setIsMakingPdf] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [savedImages, setSavedImages] = useState<StoredImage[]>([]);

  const openImageDb = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(IMAGE_DB_NAME, IMAGE_DB_VERSION);
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
          db.createObjectStore(IMAGE_STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
    });

  const getAllStoredImages = async () => {
    const db = await openImageDb();
    try {
      const images = await new Promise<StoredImage[]>((resolve, reject) => {
        const tx = db.transaction(IMAGE_STORE_NAME, 'readonly');
        const store = tx.objectStore(IMAGE_STORE_NAME);
        const request = store.getAll();
        request.onerror = () => reject(request.error ?? new Error('Failed to read saved images'));
        request.onsuccess = () => resolve((request.result as StoredImage[]) ?? []);
      });
      return images.sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_STORED_IMAGES);
    } finally {
      db.close();
    }
  };

  const saveStoredImages = async (images: StoredImage[]) => {
    const db = await openImageDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(IMAGE_STORE_NAME);
        store.clear();
        for (const image of images) {
          store.put(image);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Failed to save images'));
      });
    } finally {
      db.close();
    }
  };

  const clearStoredImagesFromDb = async () => {
    const db = await openImageDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
        tx.objectStore(IMAGE_STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Failed to clear images'));
      });
    } finally {
      db.close();
    }
  };
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Document, Paragraph, Text, History, Bold, Italic, Underline, Strike, BulletList, OrderedList, ListItem, Blockquote, Code, CodeBlock,
      Link.configure({ openOnClick: false }),
      TableKitPlus.configure(),
      MathliveExtension, ChartExtension, HeadingOne, HeadingTwo,
      ImagePlus.configure({
        // Optional: custom options
        wrapperStyle: { cursor: 'pointer' },
        containerStyle: {
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
    if (typeof window === 'undefined') return;
    getAllStoredImages()
      .then((images) => setSavedImages(images))
      .catch((error) => {
        console.error('Failed to load saved images from IndexedDB', error);
      });
  }, []);

  useEffect(() => {
    if (!editor) return;
    const h = () => {
      setUpdate(s => s + 1);
      setHtmlOutput(editor.getHTML());
    };
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

const persistSavedImages = async (updater: (prev: StoredImage[]) => StoredImage[]) => {
  const next = updater(savedImages);
  setSavedImages(next);
  try {
    await saveStoredImages(next);
  } catch (error) {
    console.error('Failed to persist saved images to IndexedDB', error);
  }
};

const addStoredImage = (src: string) => {
  void persistSavedImages(prev => {
    const deduped = prev.filter(item => item.src !== src);
    return [{ id: crypto.randomUUID(), src, createdAt: Date.now() }, ...deduped].slice(0, MAX_STORED_IMAGES);
  });
};

const insertImageFromUrl = () => {
  const src = imageUrl.trim();
  if (!src) return;
  editor.chain().focus().setImage({ src }).run();
  setImageUrl('');
  setShowImageMenu(false);
};

const insertStoredImage = (src: string) => {
  editor.chain().focus().setImage({ src }).run();
  setShowImageMenu(false);
};

const clearStoredImages = () => {
  setSavedImages([]);
  void clearStoredImagesFromDb().catch((error) => {
    console.error('Failed to clear saved images from IndexedDB', error);
  });
};

const onUploadImage: React.ChangeEventHandler<HTMLInputElement> = (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result !== 'string') {
      console.error('Unexpected FileReader result type');
      return;
    }

    const src = reader.result;
    editor.chain().focus().setImage({ src }).run();
    addStoredImage(src);
    setShowImageMenu(false);
  };
  reader.onerror = () => {
    console.error('Failed to read uploaded image');
  };
  reader.readAsDataURL(file);
  event.target.value = '';
};

const getPageRanges = (editorRoot: HTMLElement) => {
  // Look for the pagination wrapper
  const paginationElement = editorRoot.querySelector('[data-rm-pagination]');
  if (!paginationElement) {
    return [{ startY: 0, endY: editorRoot.scrollHeight }];
  }

  // Get all breaker elements (page separators)
  const breakers = Array.from(
    paginationElement.querySelectorAll<HTMLElement>('.breaker')
  );

  if (breakers.length === 0) {
    return [{ startY: 0, endY: editorRoot.scrollHeight }];
  }

  const rootRect = editorRoot.getBoundingClientRect();
  const ranges: Array<{ startY: number; endY: number }> = [];
  
  let currentStartY = 0;

  breakers.forEach((breaker, index) => {
    // Breaker marks the end of a page; get its position
    const rect = breaker.getBoundingClientRect();
    const breakerEndY = rect.top - rootRect.top;
    
    // Only add if this page has content
    if (breakerEndY > currentStartY) {
      ranges.push({ startY: currentStartY, endY: breakerEndY });
      currentStartY = breakerEndY + rect.height; // Next page starts after the breaker
    }
  });

  // Add the last page (after the last breaker to the end)
  if (currentStartY < editorRoot.scrollHeight) {
    ranges.push({ startY: currentStartY, endY: editorRoot.scrollHeight });
  }

  // Fallback if nothing detected
  if (ranges.length === 0) {
    return [{ startY: 0, endY: editorRoot.scrollHeight }];
  }

  return ranges;
};

const makePdf = async () => {
  if (!editor || isMakingPdf) return;

  setIsMakingPdf(true);
  try {
    if (showHtmlView && htmlDirty) {
      const applied = editor.commands.setContent(htmlOutput);
      if (!applied) {
        console.error('Failed to apply HTML edits before PDF export.');
        return;
      }
      setHtmlDirty(false);
    }

    const editorRoot = editor.view.dom as HTMLElement;
    
    // Add temporary style to help html2canvas  
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      /* Help html2canvas render without errors */
      * {
        filter: drop-shadow(none) !important;
      }
      math-field {
        overflow: visible !important;
        line-height: normal !important;
        padding-top: 4px !important;
        padding-bottom: 8px !important;
        contain: none !important;
        background: transparent !important;
      }
      math-field::part(container) {
        overflow: visible !important;
      }
      math-field::part(content) {
        overflow: visible !important;
      }
      math-field::part(virtual-keyboard-toggle) {
        display: none !important;
      }
      .mathfield-shell {
        overflow: visible !important;
        display: inline-block !important;
        vertical-align: middle !important;
        line-height: normal !important;
        padding-bottom: 4px !important;
      }
      /* Ensure parent containers don't clip */
      .ProseMirror p, .ProseMirror div {
        overflow: visible !important;
      }
    `;
    document.head.appendChild(styleEl);

    const pageRanges = getPageRanges(editorRoot);
    const scale = 2;

    console.log('Page ranges detected:', pageRanges);

    const fullCanvas = await html2canvas(editorRoot, {
      backgroundColor: '#ffffff',
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
    });

    document.head.removeChild(styleEl);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pdfWidth = pdf.internal.pageSize.getWidth();

    for (let index = 0; index < pageRanges.length; index += 1) {
      const { startY, endY } = pageRanges[index];
      const cropTop = Math.max(0, Math.floor(startY * scale));
      const cropHeight = Math.max(1, Math.floor((endY - startY) * scale));

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = fullCanvas.width;
      pageCanvas.height = cropHeight;

      const pageContext = pageCanvas.getContext('2d');
      if (!pageContext) {
        console.error('Could not create 2D context for PDF page rendering.');
        continue;
      }

      pageContext.drawImage(
        fullCanvas,
        0,
        cropTop,
        fullCanvas.width,
        cropHeight,
        0,
        0,
        fullCanvas.width,
        cropHeight,
      );

      if (index > 0) {
        pdf.addPage();
      }

      // Scale image to fit PDF width while preserving aspect ratio
      const imgWidthMm = pdfWidth;
      const imgHeightMm = (cropHeight / fullCanvas.width) * imgWidthMm;

      pdf.addImage(
        pageCanvas.toDataURL('image/jpeg', 0.95),
        'JPEG',
        0,
        0,
        imgWidthMm,
        imgHeightMm,
        undefined,
        'FAST'
      );
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    pdf.save(`leaf-document-${timestamp}.pdf`);
  } catch (error) {
    console.error('PDF generation failed', error);
  } finally {
    setIsMakingPdf(false);
  }
};

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

        <MenuButton onClick={() => editor.chain().focus().toggleHeadingOne().run()} isActive={editor.isActive('headingOne')} title="H1"><Heading1 size={18} /></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeadingTwo().run()} isActive={editor.isActive('headingTwo')} title="H2"><Heading2 size={18} /></MenuButton>

        <div className="w-[1px] h-6 bg-gray-200 mx-1 shrink-0" />

        <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List"><List size={18} /></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Ordered List"><ListOrdered size={18} /></MenuButton>
        <Popover.Root open={showImageMenu} onOpenChange={setShowImageMenu}>
          <Popover.Trigger asChild>
            <div className="relative">
              <MenuButton
                preventDefault={false}
                isActive={showImageMenu || editor.isActive('imagePlus')}
                title="Image"
              >
                <ImageIcon size={18} />
                <ChevronDown size={14} className={cn("ml-1 transition-transform", showImageMenu && "rotate-180")} />
              </MenuButton>
            </div>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content sideOffset={5} side="bottom" align="start" className="bg-white border rounded-md shadow-xl p-3 z-[100] w-[360px] animate-in fade-in zoom-in duration-200 space-y-3">
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-gray-700">Insert by URL</div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={imageUrl}
                    placeholder="https://example.com/image.png"
                    onChange={(e) => setImageUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        insertImageFromUrl();
                      }
                    }}
                    className="flex-1 h-9 px-2.5 border rounded-md text-xs outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <button
                    onClick={insertImageFromUrl}
                    className="h-9 px-3 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 inline-flex items-center gap-1.5"
                  >
                    <Link2 size={14} /> Add
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-gray-700">Upload from device</div>
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
                    <div className="text-xs font-semibold text-gray-700">Saved uploads</div>
                    <button
                      onClick={clearStoredImages}
                      className="text-[11px] text-red-600 hover:text-red-700 font-medium"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto">
                    {savedImages.map((image) => (
                      <button
                        key={image.id}
                        onClick={() => insertStoredImage(image.src)}
                        className="h-16 border rounded-md overflow-hidden hover:border-blue-400"
                        title="Insert saved image"
                      >
                        <img src={image.src} alt="Saved upload" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
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
          onClick={() => editor.chain().focus().insertChart().run()}
          className="ml-2 p-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center gap-1.5 px-3 shadow-sm shrink-0"
        >
          <BarChart3 size={18} /> <span className="text-sm font-bold">Chart</span>
        </button>

        <button
          onClick={() => editor.chain().focus().insertMath().run()}
          className="ml-2 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5 px-3 shadow-sm shrink-0"
        >
          <Sigma size={18} /> <span className="text-sm font-bold">Math</span>
        </button>
        <button
          onClick={() => {
            if (!showHtmlView) {
              setHtmlOutput(editor.getHTML());
              setHtmlDirty(false);
              setShowHtmlView(true);
              return;
            }

            if (htmlDirty) {
              const applied = editor.commands.setContent(htmlOutput);
              if (!applied) {
                console.error('Failed to apply HTML changes to editor content.');
              }
            }
            setHtmlDirty(false);
            setShowHtmlView(false);
          }}
          className={cn(
            "ml-2 p-2 rounded-md flex items-center gap-1.5 px-3 shadow-sm shrink-0",
            showHtmlView
              ? "bg-violet-700 text-white hover:bg-violet-800"
              : "bg-violet-600 text-white hover:bg-violet-700"
          )}
        >
          <FileCode2 size={18} />
          <span className="text-sm font-bold">{showHtmlView ? 'Editor' : 'HTML'}</span>
        </button>

        <div className="flex-1" />

        <button
          onClick={() => void makePdf()}
          disabled={isMakingPdf}
          className={cn(
            "p-2 text-white rounded-md flex items-center gap-1.5 px-3 shadow-sm shrink-0 ml-4",
            isMakingPdf ? "bg-gray-500 cursor-not-allowed" : "bg-gray-800 hover:bg-black",
          )}
        >
          <Printer size={18} /> <span className="text-sm font-bold">{isMakingPdf ? 'Building PDF…' : 'Print'}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-10 flex flex-col items-center tiptap-page-container">
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

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    headingOne: { toggleHeadingOne: () => ReturnType; }
    headingTwo: { toggleHeadingTwo: () => ReturnType; }
  }
}
