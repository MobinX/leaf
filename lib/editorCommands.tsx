import React from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline, List, ListOrdered,
  Heading, Quote as QuoteIcon,
  Strikethrough, Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
  Heading3, Table as TableIcon, Sigma, Undo, Redo,
  Image as ImageIcon,
  BetweenVerticalStartIcon, BetweenHorizonalStartIcon,
  Trash2, Link2, Upload, Columns2, Rows2,
  TableCellsMerge, TableCellsSplit, Square, ArrowRight, ArrowLeft,
  Wrench, Grid2X2, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  BarChart3, Code, CodeXml
} from 'lucide-react';

export interface EditorCommand {
  title: string;
  command: (range?: { from: number; to: number }) => void;
  icon: React.ReactNode;
  category?: string;
}

export function getAllCommandList(editor: Editor): EditorCommand[] {
  if (!editor) return [];

  const withRange = (cb: (chain: any) => any, range?: { from: number; to: number }) => {
    let chain = editor.chain().focus();
    if (range) {
      chain = chain.deleteRange(range);
    }
    cb(chain).run();
  };

  const insertHeadingBeforeCurrentTable = (range?: { from: number; to: number }) => {
    const { $from } = editor.state.selection;
    let tableDepth = -1;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if ($from.node(depth).type.name === 'table') { tableDepth = depth; break; }
    }
    
    let chain = editor.chain().focus();
    if (range) chain = chain.deleteRange(range);

    if (tableDepth === -1) { 
      chain.insertContent({ type: 'heading', attrs: { level: 3 } }).run(); 
      return; 
    }
    chain.insertContentAt($from.before(tableDepth), { type: 'heading', attrs: { level: 3 } }).run();
  };

  const insertHeadingAfterCurrentTable = (range?: { from: number; to: number }) => {
    const { $from } = editor.state.selection;
    let tableDepth = -1;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if ($from.node(depth).type.name === 'table') { tableDepth = depth; break; }
    }
    
    let chain = editor.chain().focus();
    if (range) chain = chain.deleteRange(range);

    if (tableDepth === -1) { 
      chain.insertContent({ type: 'heading', attrs: { level: 3 } }).run(); 
      return; 
    }
    chain.insertContentAt($from.after(tableDepth), { type: 'heading', attrs: { level: 3 } }).run();
  };

  return [
    // History
    { title: 'Undo', command: (range) => withRange(c => c.undo(), range), icon: <Undo size={18} />, category: 'History' },
    { title: 'Redo', command: (range) => withRange(c => c.redo(), range), icon: <Redo size={18} />, category: 'History' },

    // Basic Formatting
    { title: 'Bold', command: (range) => withRange(c => c.toggleBold(), range), icon: <Bold size={18} />, category: 'Formatting' },
    { title: 'Italic', command: (range) => withRange(c => c.toggleItalic(), range), icon: <Italic size={18} />, category: 'Formatting' },
    { title: 'Underline', command: (range) => withRange(c => c.toggleUnderline(), range), icon: <Underline size={18} />, category: 'Formatting' },
    { title: 'Strikethrough', command: (range) => withRange(c => c.toggleStrike(), range), icon: <Strikethrough size={18} />, category: 'Formatting' },
    { title: 'Subscript', command: (range) => withRange(c => c.toggleSubscript(), range), icon: <SubscriptIcon size={18} />, category: 'Formatting' },
    { title: 'Superscript', command: (range) => withRange(c => c.toggleSuperscript(), range), icon: <SuperscriptIcon size={18} />, category: 'Formatting' },
    { title: 'Inline Code', command: (range) => withRange(c => c.toggleCode(), range), icon: <Code size={18} />, category: 'Formatting' },
    { title: 'Code Block', command: (range) => withRange(c => c.toggleCodeBlock(), range), icon: <CodeXml size={18} />, category: 'Formatting' },
    { title: 'Blockquote', command: (range) => withRange(c => c.toggleBlockquote(), range), icon: <QuoteIcon size={18} />, category: 'Formatting' },

    // Headings
    { title: 'Heading 1', command: (range) => withRange(c => c.toggleHeading({ level: 1 }), range), icon: <Heading size={18} />, category: 'Headings' },
    { title: 'Heading 2', command: (range) => withRange(c => c.toggleHeading({ level: 2 }), range), icon: <Heading size={18} />, category: 'Headings' },
    { title: 'Heading 3', command: (range) => withRange(c => c.toggleHeading({ level: 3 }), range), icon: <Heading size={18} />, category: 'Headings' },
    { title: 'Heading 4', command: (range) => withRange(c => c.toggleHeading({ level: 4 }), range), icon: <Heading size={18} />, category: 'Headings' },
    { title: 'Heading 5', command: (range) => withRange(c => c.toggleHeading({ level: 5 }), range), icon: <Heading size={18} />, category: 'Headings' },
    { title: 'Heading 6', command: (range) => withRange(c => c.toggleHeading({ level: 6 }), range), icon: <Heading size={18} />, category: 'Headings' },

    // Lists
    { title: 'Bullet List', command: (range) => withRange(c => c.toggleBulletList(), range), icon: <List size={18} />, category: 'Lists' },
    { title: 'Ordered List', command: (range) => withRange(c => c.toggleOrderedList(), range), icon: <ListOrdered size={18} />, category: 'Lists' },

    // Alignment
    { title: 'Align Left', command: (range) => withRange(c => c.setTextAlign('left'), range), icon: <AlignLeft size={18} />, category: 'Alignment' },
    { title: 'Align Center', command: (range) => withRange(c => c.setTextAlign('center'), range), icon: <AlignCenter size={18} />, category: 'Alignment' },
    { title: 'Align Right', command: (range) => withRange(c => c.setTextAlign('right'), range), icon: <AlignRight size={18} />, category: 'Alignment' },
    { title: 'Align Justify', command: (range) => withRange(c => c.setTextAlign('justify'), range), icon: <AlignJustify size={18} />, category: 'Alignment' },

    // Insertions
    { title: 'Insert Math', command: (range) => withRange(c => c.insertMath(), range), icon: <Sigma size={18} />, category: 'Insert' },
    { title: 'Insert Chart', command: (range) => withRange(c => c.insertChart(), range), icon: <BarChart3 size={18} />, category: 'Insert' },
    { title: 'Insert Table (3x3)', command: (range) => withRange(c => c.insertTable({ rows: 3, cols: 3 }), range), icon: <Grid2X2 size={18} />, category: 'Insert' },

    // Table Actions
    { title: 'Table: Add Column Before', command: (range) => withRange(c => c.addColumnBefore(), range), icon: <BetweenVerticalStartIcon size={16} />, category: 'Table' },
    { title: 'Table: Add Column After', command: (range) => withRange(c => c.addColumnAfter(), range), icon: <BetweenVerticalStartIcon size={16} className="rotate-180" />, category: 'Table' },
    { title: 'Table: Delete Column', command: (range) => withRange(c => c.deleteColumn(), range), icon: <Trash2 size={16} />, category: 'Table' },
    { title: 'Table: Add Row Before', command: (range) => withRange(c => c.addRowBefore(), range), icon: <BetweenHorizonalStartIcon size={16} />, category: 'Table' },
    { title: 'Table: Add Row After', command: (range) => withRange(c => c.addRowAfter(), range), icon: <BetweenHorizonalStartIcon size={16} className="rotate-180" />, category: 'Table' },
    { title: 'Table: Delete Row', command: (range) => withRange(c => c.deleteRow(), range), icon: <Trash2 size={16} />, category: 'Table' },
    { title: 'Table: Merge Cells', command: (range) => withRange(c => c.mergeCells(), range), icon: <TableCellsMerge size={16} />, category: 'Table' },
    { title: 'Table: Split Cell', command: (range) => withRange(c => c.splitCell(), range), icon: <TableCellsSplit size={16} />, category: 'Table' },
    { title: 'Table: Toggle Header Row', command: (range) => withRange(c => c.toggleHeaderRow(), range), icon: <Rows2 size={16} />, category: 'Table' },
    { title: 'Table: Toggle Header Column', command: (range) => withRange(c => c.toggleHeaderColumn(), range), icon: <Columns2 size={16} />, category: 'Table' },
    { title: 'Table: Toggle Header Cell', command: (range) => withRange(c => c.toggleHeaderCell(), range), icon: <Square size={16} />, category: 'Table' },
    { title: 'Table: Merge or Split', command: (range) => withRange(c => c.mergeOrSplit(), range), icon: <TableCellsMerge size={16} />, category: 'Table' },
    { title: 'Table: Set Colspan 2', command: (range) => withRange(c => c.setCellAttribute('colspan', 2), range), icon: <Grid2X2 size={16} />, category: 'Table' },
    { title: 'Table: Fix Tables', command: (range) => withRange(c => c.fixTables(), range), icon: <Wrench size={16} />, category: 'Table' },
    { title: 'Table: Go to Previous Cell', command: (range) => withRange(c => c.goToPreviousCell(), range), icon: <ArrowLeft size={16} />, category: 'Table' },
    { title: 'Table: Go to Next Cell', command: (range) => withRange(c => c.goToNextCell(), range), icon: <ArrowRight size={16} />, category: 'Table' },
    { title: 'Table: Insert Heading Before', command: (range) => insertHeadingBeforeCurrentTable(range), icon: <Heading3 size={16} />, category: 'Table' },
    { title: 'Table: Insert Heading After', command: (range) => insertHeadingAfterCurrentTable(range), icon: <Heading3 size={16} />, category: 'Table' },
    { title: 'Table: Delete Table', command: (range) => withRange(c => c.deleteTable(), range), icon: <Trash2 size={16} className="text-red-500" />, category: 'Table' },
  ];
}
