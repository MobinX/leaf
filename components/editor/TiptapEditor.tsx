'use client';

import React, { useEffect, useRef, useState } from 'react';
import 'mathlive';
import type { MathfieldElement } from 'mathlive';
import { useEditor, EditorContent, Node, mergeAttributes } from '@tiptap/react';
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { Bold } from '@tiptap/extension-bold';
import { Italic } from '@tiptap/extension-italic';
import { Underline } from '@tiptap/extension-underline';
import { Strike } from '@tiptap/extension-strike';
import { History } from '@tiptap/extension-history';
import { TableKit } from '@tiptap/extension-table';
import { BulletList } from '@tiptap/extension-bullet-list';
import { OrderedList } from '@tiptap/extension-ordered-list';
import { ListItem } from '@tiptap/extension-list-item';
import { Blockquote } from '@tiptap/extension-blockquote';
import { Link } from '@tiptap/extension-link';
import { ImagePlus } from 'tiptap-image-plus';
import { Code } from '@tiptap/extension-code';
import { CodeBlock } from '@tiptap/extension-code-block';
import { PaginationPlus, PAGE_SIZES } from 'tiptap-pagination-plus';
import { TextAlign } from '@tiptap/extension-text-align';
import { Mathematics } from '@tiptap/extension-mathematics';
import { TextStyle } from '@tiptap/extension-text-style';
import { ChartExtension } from './ChartExtension';
import { FontSizeExtension } from './FontSizeExtension';
import { cn } from '@/lib/utils';
import * as Popover from '@radix-ui/react-popover';
import {
  Bold as BoldIcon, Italic as ItalicIcon, Underline as UnderlineIcon,
  Heading3, List, ListOrdered,
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
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  BarChart3,
  FileText,
  Copy,
} from 'lucide-react';

const LAB_REPORT_PROMPT_TEXT = `You need to write a lab report in basic html no css is allowed cause your html will be rendered by a markdown editor. That means the layout needs to be semantic and accessible using only standard HTML elements. you might use align attribute. You need to write Theory, apparatus, make table of data with caption and heading , write calculation with the help of math latex and write discussion. From the provided pdf learn the theory , discussion , calculation pattern and how you should compose the whole document . then learn from the style , pattern, order from the pdf. then see the extra images of data and data tables . keep in mind you only learn from the pdf file dont copy data from there. you need to use data from the images provided to you. based on the provided data image you need to write calculation . also you need to create a table and calculation for least square fitting. like formula for getting slope and intersection etc and calculation for that. how to write calculation learn from those pdf and write calculation based on provided images. then write result and discussion on findings. discussion should be short and concise. 3 point.Now there are two special tag you will use one is <math>latex code</math> . use this to write math equation only . for multi line you may use multiple <math> with line break.

CHART TAG FORMAT (Support multiple datasets):
<chart data-datasets='[{"id":"ds1","xData":[1,2,3],"yData":[2,4,6],"model":"linear","label":"Dataset1"},{"id":"ds2","xData":[1,2,3],"yData":[1.5,3.5,5.5],"model":"linear","label":"Dataset2"}]' data-x-label="X" data-y-label="Y" data-width="100%" data-height="70vh" data-alignment="center"></chart>

CHART RULES:
1) Each dataset MUST have: id (unique string), xData (number array), yData (number array), model (fitting model), label (optional display name)
2) ALL datasets share SAME x-label and y-label
3) Supported models: linear, linear_y_mx, exponential, logarithmic, sine, cosine, tangent, power, logistic, polynomial, gaussian
4) Chart auto-computes least-squares fit for each dataset with its specified model
5) Multiple datasets are plotted together with different colors
6) You can have ONE or MANY datasets in a single chart

USAGE EXAMPLE:
- Single dataset: <chart data-datasets='[{"id":"exp1","xData":[5,10,15],"yData":[25,100,225],"model":"power"}]' data-x-label="Distance" data-y-label="Intensity"></chart>
- Multi dataset: Above example with 2 datasets of same X values

some extra info you must keep remeber,
1) THEORY always CONTAIN DRIVATION DEFINATION AND OVERAL DESCRIPTION
2) BEFORE GRAPH , GIVE H3 HEADER OF GRAPH
3) AFTER GRAPH GIVE ITALIC HEADER OF FIGURE 2, LIKE DESCRIPTION
`;


const COVER_TEMPLATES = {
  'M-012': `<h2 style="text-align: center; font-size: 30px; font-weight: 700; color: black; display: block; margin: 0.4em 0px;">Lab Report</h2><p style="text-align: center;"></p><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em><u>Experiment name:  </u></em></h3><h4 style="text-align: left; font-size: 20px; font-weight: 700; color: black; display: block; margin: 0.2em 0px;"><strong><em><u>jkjkjkasjdfkjadsfjkasdkfjasdfkjasdfjaskdljfkl;sdjflkasdjfklsdjfsdjfksdjfsldjfklsdjfklsdajflsdjfk</u></em></strong></h4><p style="text-align: left;"></p><p style="text-align: left;"></p><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em><u>Experiment Number :</u>   O5</em></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em><u>Experiment Date:</u>  02/02/2026</em></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em><u>Name</u>: Md. Mobin Chowdhury</em></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em><u>Roll</u>: FH-118-012</em></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em><u>Lab</u> Group: C</em></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em><u>Batch</u> : 05</em></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em><u>Session</u>: 2023-24</em></h3><h4 style="text-align: left; font-size: 20px; font-weight: 700; color: black; display: block; margin: 0.2em 0px;">  </h4><p style="text-align: left;"></p><p style="text-align: left;"></p><h2 style="text-align: center; font-size: 30px; font-weight: 700; color: black; display: block; margin: 0.4em 0px;">University of Dhaka</h2><h2 style="text-align: center; font-size: 30px; font-weight: 700; color: black; display: block; margin: 0.4em 0px;">Department of Physics</h2><p style="text-align: left;"></p><p style="text-align: left;">   </p><p style="text-align: left;"></p><p style="text-align: left;"></p><p style="text-align: center;"></p><p style="text-align: center;"></p>`,
  'S-60': `<h2 style="text-align: center; font-size: 30px; font-weight: 700; color: black; display: block; margin: 0.4em 0px;"><strong>University of Dhaka</strong></h2><h2 style="text-align: center; font-size: 30px; font-weight: 700; color: black; display: block; margin: 0.4em 0px;"><strong>Department of Physics</strong></h2><h3 style="text-align: center; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><strong>Lab Report</strong></h3><p style="text-align: center;"></p><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><strong><em><u>Experiment name:  </u></em></strong></h3><h4 style="text-align: left; font-size: 20px; font-weight: 700; color: black; display: block; margin: 0.2em 0px;"><strong><em><u>jkjkjkasjdfkjadsfjkasdkfjasdfkjasdfjaskdljfkl;sdjflkasdjfklsdjfsdjfksdjfsldjfklsdjfklsdajflsdjfk</u></em></strong></h4><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><strong><em><u>Experiment Number :</u>   O5</em></strong></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><strong><em><u>Experiment Date:</u>  02/02/2025</em></strong></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"></h3><h3 style="text-align: center; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><strong><em>Submitted by:</em></strong></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em>     Name: Md. Sadik Hossen</em></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em>    Roll: AE-118-060</em></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em>    Lab Group: C</em></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em>   Batch : 05</em></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em>   Session: 2023-24</em></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"></h3><p style="text-align: left;"></p><h1 style="text-align: left; font-size: 40px; font-weight: 800; color: black; display: block; margin: 0.5em 0px;">Stable Custom H1</h1><p style="text-align: left;">This editor is now print-optimized.yyyyy</p>`,




  'R-66': `<h2 style="text-align: center; font-size: 30px; font-weight: 700; color: black; display: block; margin: 0.4em 0px;">Lab Report</h2><p style="text-align: center;"></p><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em><u>Name of Experiment:  </u></em></h3><h4 style="text-align: left; font-size: 20px; font-weight: 700; color: black; display: block; margin: 0.2em 0px;"><strong><em><u>jkjkjkasjdfkjadsfjkasdkfjasdfkjasdfjaskdljfkl;sdjflkasdjfklsdjfsdjfksdjfsldjfklsdjfklsdajflsdjfk</u></em></strong></h4><p style="text-align: left;"></p><p style="text-align: left;"></p><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em><u>Number of Experiment :</u>   O5</em></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em><u>Date of Experiment :</u>  02/02/2026</em></h3><h2 style="text-align: center; font-size: 30px; font-weight: 700; color: black; display: block; margin: 0.4em 0px;"><em>Submitted By</em></h2><p style="text-align: center;"></p><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em><u>Name</u>: Raisa Alam</em></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em><u>Roll</u>: SK-118-066</em></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em><u>Lab</u> Group: C</em></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em><u>Batch</u> : 05</em></h3><h3 style="text-align: left; font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0px;"><em><u>Session</u>: 2023-24</em></h3><h4 style="text-align: left; font-size: 20px; font-weight: 700; color: black; display: block; margin: 0.2em 0px;">  </h4><p style="text-align: left;"></p><p style="text-align: left;"></p><h2 style="text-align: center; font-size: 30px; font-weight: 700; color: black; display: block; margin: 0.4em 0px;">University of Dhaka</h2><h2 style="text-align: center; font-size: 30px; font-weight: 700; color: black; display: block; margin: 0.4em 0px;">Department of Physics</h2><p style="text-align: left;"></p><p style="text-align: left;">   </p><p style="text-align: left;"></p><p style="text-align: left;"></p><p style="text-align: center;"></p><p style="text-align: center;"></p>`
};

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

const HeadingThree = Node.create({
  name: 'headingThree', group: 'block', content: 'inline*',
  parseHTML() { return [{ tag: 'h3' }] },
  renderHTML({ HTMLAttributes }) { return ['h3', mergeAttributes(HTMLAttributes, { style: 'font-size: 24px; font-weight: 700; color: black; display: block; margin: 0.3em 0;' }), 0] },
  addCommands() { return { toggleHeadingThree: () => ({ commands }) => commands.toggleNode(this.name, 'paragraph') } }
});

const HeadingFour = Node.create({
  name: 'headingFour', group: 'block', content: 'inline*',
  parseHTML() { return [{ tag: 'h4' }] },
  renderHTML({ HTMLAttributes }) { return ['h4', mergeAttributes(HTMLAttributes, { style: 'font-size: 20px; font-weight: 700; color: black; display: block; margin: 0.2em 0;' }), 0] },
  addCommands() { return { toggleHeadingFour: () => ({ commands }) => commands.toggleNode(this.name, 'paragraph') } }
});

const HeadingFive = Node.create({
  name: 'headingFive', group: 'block', content: 'inline*',
  parseHTML() { return [{ tag: 'h5' }] },
  renderHTML({ HTMLAttributes }) { return ['h5', mergeAttributes(HTMLAttributes, { style: 'font-size: 18px; font-weight: 600; color: black; display: block; margin: 0.2em 0;' }), 0] },
  addCommands() { return { toggleHeadingFive: () => ({ commands }) => commands.toggleNode(this.name, 'paragraph') } }
});

const HeadingSix = Node.create({
  name: 'headingSix', group: 'block', content: 'inline*',
  parseHTML() { return [{ tag: 'h6' }] },
  renderHTML({ HTMLAttributes }) { return ['h6', mergeAttributes(HTMLAttributes, { style: 'font-size: 16px; font-weight: 600; color: black; display: block; margin: 0.2em 0;' }), 0] },
  addCommands() { return { toggleHeadingSix: () => ({ commands }) => commands.toggleNode(this.name, 'paragraph') } }
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

export default function TiptapEditor({ initialContent, onContentChange }: { initialContent?: string, onContentChange?: (html: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showImageMenu, setShowImageMenu] = useState(false);
  const [showCoverMenu, setShowCoverMenu] = useState(false);
  const [showHtmlView, setShowHtmlView] = useState(false);
  const [htmlOutput, setHtmlOutput] = useState('');
  const [htmlDirty, setHtmlDirty] = useState(false);
  const [isPromptCopied, setIsPromptCopied] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [showMathEditor, setShowMathEditor] = useState(false);
  const [mathEditorLatex, setMathEditorLatex] = useState('');
  const [mathEditorPos, setMathEditorPos] = useState<number | null>(null);
  const [mathEditorType, setMathEditorType] = useState<'inline' | 'block'>('inline');
  const mathFieldRef = useRef<MathfieldElement>(null);
  const [mathliveReady, setMathliveReady] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(customElements.get('math-field'));
  });
  const mathEditorLatexRef = useRef('');
  const [mathFieldFocused, setMathFieldFocused] = useState(false);
  const [savedImages, setSavedImages] = useState<StoredImage[]>([]);

  const confirmMathEdit = () => {
    const latexValue = mathFieldRef.current?.value ?? mathEditorLatex;
    if (!latexValue.trim() || !editor) return;
    if (mathEditorPos !== null) {
      if (mathEditorType === 'inline') {
        editor.chain().focus().updateInlineMath({ latex: latexValue, pos: mathEditorPos }).run();
      } else {
        editor.chain().focus().updateBlockMath({ latex: latexValue, pos: mathEditorPos }).run();
      }
    } else {
      if (mathEditorType === 'inline') {
        editor.chain().focus().insertInlineMath({ latex: latexValue }).run();
      } else {
        editor.chain().focus().insertBlockMath({ latex: latexValue }).run();
      }
    }
    setShowMathEditor(false);
  };

  useEffect(() => {
    mathEditorLatexRef.current = mathEditorLatex;
  }, [mathEditorLatex]);

  useEffect(() => {
    if (mathliveReady || typeof window === 'undefined') return;

    let active = true;

    customElements.whenDefined('math-field').then(() => {
      if (active) {
        setMathliveReady(true);
      }
    });

    return () => {
      active = false;
    };
  }, [mathliveReady]);

  useEffect(() => {
    if (!showMathEditor || !mathliveReady || !mathFieldRef.current) return;

    const mathField = mathFieldRef.current;
    mathField.value = mathEditorLatexRef.current || '';

    const handleInput = (event: Event) => {
      const target = event.target as MathfieldElement;
      setMathEditorLatex(target.value);
    };

    mathField.addEventListener('input', handleInput);

    setTimeout(() => mathField.focus(), 0);

    return () => {
      mathField.removeEventListener('input', handleInput);
    };
  }, [showMathEditor, mathliveReady]);

  useEffect(() => {
    if (!showMathEditor || !mathliveReady || !mathFieldRef.current) return;
    if (mathFieldRef.current.value !== mathEditorLatex) {
      mathFieldRef.current.value = mathEditorLatex || '';
    }
  }, [mathEditorLatex, showMathEditor, mathliveReady]);

  const insertCoverPage = (key: keyof typeof COVER_TEMPLATES) => {
    if (!editor) return;
    editor.chain().focus().insertContentAt(0, COVER_TEMPLATES[key]).run();
    setShowCoverMenu(false);
  };

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
    editable: true,
    extensions: [
      Document, Paragraph, Text, History, Bold, Italic, Underline, Strike, TextStyle, FontSizeExtension, BulletList, OrderedList, ListItem, Blockquote, Code, CodeBlock,
      Link.configure({ openOnClick: false }),
      TableKit.configure({
        table: {
          resizable: true,
          cellMinWidth: 60,
          lastColumnResizable: true,
          HTMLAttributes: {
            class: 'tiptap-full-width-table',
            style: 'width: 100%;',
          },
        },
      }),
      TextAlign.configure({
        types: ['paragraph', 'headingOne', 'headingTwo', 'headingThree', 'headingFour', 'headingFive', 'headingSix'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: 'left',
      }),
      Mathematics.configure({
        katexOptions: { throwOnError: false },
        inlineOptions: {
          onClick: (node, pos) => {
            setMathEditorLatex(node.attrs.latex || '');
            setMathEditorPos(pos);
            setMathEditorType('inline');
            setShowMathEditor(true);
          },
        },
        blockOptions: {
          onClick: (node, pos) => {
            setMathEditorLatex(node.attrs.latex || '');
            setMathEditorPos(pos);
            setMathEditorType('block');
            setShowMathEditor(true);
          },
        },
      }), ChartExtension, HeadingOne, HeadingTwo, HeadingThree, HeadingFour, HeadingFive, HeadingSix,
      ImagePlus.configure({
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
    content: initialContent || `<h1>Stable Custom H1</h1><p>This editor is now print-optimized.</p>`,
  });

  // Sync initialContent if it changes from outside
  useEffect(() => {
    if (editor && initialContent !== undefined && initialContent !== editor.getHTML()) {
      // Only sync if the editor is empty or if we really want to force update
      // For now, let's just sync if it's different and we are at the beginning
      const currentHtml = editor.getHTML();
      if (currentHtml === '<p></p>' || currentHtml === '<h1>Stable Custom H1</h1><p>This editor is now print-optimized.</p>') {
        editor.commands.setContent(initialContent);
      }
    }
  }, [editor, initialContent]);

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

    let debounceTimer: NodeJS.Timeout;

    const h = () => {
      setUpdate(s => s + 1);
      const html = editor.getHTML();
      setHtmlOutput(html);

      // Call the callback when content changes
      if (onContentChange) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          onContentChange(html);
        }, 1000);
      }
    };

    editor.on('transaction', h);
    return () => {
      editor.off('transaction', h);
      clearTimeout(debounceTimer);
    };
  }, [editor, onContentChange]);

  if (!editor) return null;


const insertHeadingAfterCurrentTable = () => {
  const { $from } = editor.state.selection;
  let tableDepth = -1;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'table') {
      tableDepth = depth;
      break;
    }
  }

  if (tableDepth === -1) {
    editor.chain().focus().insertContent({ type: 'headingThree' }).run();
    return;
  }

  const insertPos = $from.after(tableDepth);
  editor.chain().focus().insertContentAt(insertPos, { type: 'headingThree' }).run();
};

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
  { label: 'Insert after table', icon: <Heading3 size={16} />, onClick: insertHeadingAfterCurrentTable },
  { label: 'Del Table', icon: <Trash2 size={16} className="text-red-500" />, onClick: () => editor.chain().focus().deleteTable().run() },
];

const headingOptions = [
  { label: 'H1', title: 'Heading 1', isActive: editor.isActive('headingOne'), onClick: () => editor.chain().focus().toggleHeadingOne().run() },
  { label: 'H2', title: 'Heading 2', isActive: editor.isActive('headingTwo'), onClick: () => editor.chain().focus().toggleHeadingTwo().run() },
  { label: 'H3', title: 'Heading 3', isActive: editor.isActive('headingThree'), onClick: () => editor.chain().focus().toggleHeadingThree().run() },
  { label: 'H4', title: 'Heading 4', isActive: editor.isActive('headingFour'), onClick: () => editor.chain().focus().toggleHeadingFour().run() },
  { label: 'H5', title: 'Heading 5', isActive: editor.isActive('headingFive'), onClick: () => editor.chain().focus().toggleHeadingFive().run() },
  { label: 'H6', title: 'Heading 6', isActive: editor.isActive('headingSix'), onClick: () => editor.chain().focus().toggleHeadingSix().run() },
];

const activeHeadingLabel = headingOptions.find((option) => option.isActive)?.label ?? 'H';
const fontSizes = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];
const currentFontSize = editor.getAttributes('textStyle').fontSize ?? '';

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

const handlePrintClick = () => {
  if (showHtmlView) {
    if (htmlDirty) {
      const applied = editor.commands.setContent(htmlOutput);
      if (!applied) {
        console.error('Failed to apply HTML changes before printing.');
        return;
      }
      setHtmlDirty(false);
    }
    setShowHtmlView(false);
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    return;
  }

  window.print();
};

const copyLabPrompt = async () => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(LAB_REPORT_PROMPT_TEXT);
    } else {
      const temp = document.createElement('textarea');
      temp.value = LAB_REPORT_PROMPT_TEXT;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
    }
    setIsPromptCopied(true);
    window.setTimeout(() => setIsPromptCopied(false), 1500);
  } catch (error) {
    console.error('Failed to copy lab prompt text', error);
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

          body * {
            visibility: hidden !important;
          }

          #printableArea,
          #printableArea * {
            visibility: visible !important;
          }
          
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

      <div className="flex-none  w-full bg-white border-b p-1.5  flex items-center gap-1 overflow-x-auto no-scrollbar shadow-sm z-50 no-print">
        <MenuButton onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo size={18} /></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo size={18} /></MenuButton>
        <div className="w-[1px] h-6 bg-gray-200 mx-1 shrink-0" />

        <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold"><BoldIcon size={18} /></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic"><ItalicIcon size={18} /></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline"><UnderlineIcon size={18} /></MenuButton>

        <div className="w-[1px] h-6 bg-gray-200 mx-1 shrink-0" />

        <MenuButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Align Left"><AlignLeft size={18} /></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Align Center"><AlignCenter size={18} /></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Align Right"><AlignRight size={18} /></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })} title="Justify"><AlignJustify size={18} /></MenuButton>

        <div className="w-[1px] h-6 bg-gray-200 mx-1 shrink-0" />

        <Popover.Root open={showHeadingMenu} onOpenChange={setShowHeadingMenu}>
          <Popover.Trigger asChild>
            <div className="relative">
              <MenuButton
                preventDefault={false}
                isActive={showHeadingMenu || headingOptions.some((option) => option.isActive)}
                title="Headings"
                className="gap-1 px-2"
              >
                <span className="text-xs font-semibold">{activeHeadingLabel}</span>
                <ChevronDown size={14} className={cn("ml-1 transition-transform", showHeadingMenu && "rotate-180")} />
              </MenuButton>
            </div>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content sideOffset={5} side="bottom" align="start" className="bg-white border rounded-md shadow-xl p-2 z-[100] flex flex-col gap-1 min-w-[160px] animate-in fade-in zoom-in duration-200">
              {headingOptions.map((option) => (
                <button
                  key={option.label}
                  onClick={(event) => {
                    event.preventDefault();
                    option.onClick();
                    setShowHeadingMenu(false);
                  }}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md text-left transition-colors",
                    option.isActive ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <span className="font-semibold">{option.label}</span>
                  <span className="text-xs text-gray-500">{option.title}</span>
                </button>
              ))}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <select
          value={currentFontSize}
          onChange={(event) => {
            const value = event.target.value;
            if (!value) {
              editor.chain().focus().unsetFontSize().run();
              return;
            }
            editor.chain().focus().setFontSize(value).run();
          }}
          title="Font size"
          className="h-[36px] rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Font size</option>
          {fontSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>

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

        <Popover.Root open={showCoverMenu} onOpenChange={setShowCoverMenu}>
          <Popover.Trigger asChild>
            <div className="relative">
              <button
                className="ml-2 p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-1.5 px-3 shadow-sm shrink-0"
              >
                <FileText size={18} /> <span className="text-sm font-bold">CoverPage</span>
                <ChevronDown size={14} className={cn("ml-1 transition-transform", showCoverMenu && "rotate-180")} />
              </button>
            </div>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content sideOffset={5} side="bottom" align="start" className="bg-white border rounded-md shadow-xl p-2 z-[100] flex flex-col gap-1 min-w-[120px] animate-in fade-in zoom-in duration-200">
              {(Object.keys(COVER_TEMPLATES) as Array<keyof typeof COVER_TEMPLATES>).map((key) => (
                <button
                  key={key}
                  onClick={() => insertCoverPage(key)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md text-left transition-colors"
                >
                  {key}
                </button>
              ))}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      

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
        <button
          onClick={() => void copyLabPrompt()}
          className={cn(
            "ml-2 p-2 rounded-md flex items-center gap-1.5 px-3 shadow-sm shrink-0",
            isPromptCopied
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-amber-600 text-white hover:bg-amber-700",
          )}
          title="Copy lab report prompt"
        >
          <Copy size={18} />
          <span className="text-sm font-bold">{isPromptCopied ? 'Copied' : 'Copy Prompt'}</span>
        </button>

        <button
        onClick={handlePrintClick}
        className="p-2 text-white rounded-md flex items-center gap-1.5 px-3 shadow-sm shrink-0 ml-4 bg-gray-800 hover:bg-black"
        >
        <Printer size={18} /> <span className="text-sm font-bold">Print</span>
        </button>

        <button
        onClick={() => {
          setMathEditorLatex('');
          setMathEditorPos(null);
          setMathEditorType('inline');
          setShowMathEditor(true);
        }}
        className="ml-2 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5 px-3 shadow-sm shrink-0"
        >
        <Sigma size={18} /> <span className="text-sm font-bold">Math</span>
        </button>

        <button
        onClick={() => editor.chain().focus().insertChart().run()}
        className="ml-2 p-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center gap-1.5 px-3 shadow-sm shrink-0"
        >
        <BarChart3 size={18} /> <span className="text-sm font-bold">Chart</span>
        </button>



      </div>

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

      {showMathEditor && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
          onClick={() => setShowMathEditor(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">
                {mathEditorPos !== null ? 'Edit Math' : 'Insert Math'}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setMathEditorType('inline')}
                  className={cn('px-3 py-1 rounded-md text-sm font-medium border', mathEditorType === 'inline' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100')}
                >Inline</button>
                <button
                  onClick={() => setMathEditorType('block')}
                  className={cn('px-3 py-1 rounded-md text-sm font-medium border', mathEditorType === 'block' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100')}
                >Block</button>
              </div>
            </div>
            {mathliveReady ? (
              <div className="mathfield-shell w-full" data-mathlive-focused={mathFieldFocused}>
                <math-field
                  ref={mathFieldRef}
                  value={mathEditorLatex}
                  className="w-full rounded-lg border border-gray-300 bg-white p-3 text-base outline-none focus:ring-2 focus:ring-blue-400"
                  style={{ minHeight: '120px' }}
                  virtual-keyboard-mode="onfocus"
                  onFocus={() => setMathFieldFocused(true)}
                  onBlur={() => setMathFieldFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      confirmMathEdit();
                    }
                  }}
                />
              </div>
            ) : (
              <div className="w-full rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
                Loading MathLive editor…
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowMathEditor(false)}
                className="px-4 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 text-sm font-medium"
              >Cancel</button>
              {mathEditorPos !== null && (
                <button
                  onClick={() => {
                    if (mathEditorType === 'inline') {
                      editor?.chain().focus().deleteInlineMath({ pos: mathEditorPos }).run();
                    } else {
                      editor?.chain().focus().deleteBlockMath({ pos: mathEditorPos }).run();
                    }
                    setShowMathEditor(false);
                  }}
                  className="px-4 py-2 rounded-md bg-red-100 text-red-700 hover:bg-red-200 text-sm font-medium border border-red-200"
                >Delete</button>
              )}
              <button
                onClick={confirmMathEdit}
                disabled={!mathEditorLatex.trim()}
                className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mathEditorPos !== null ? 'Update' : 'Insert'}
              </button>
            </div>
            <p className="text-xs text-gray-400">Tip: Press Ctrl+Enter to confirm. Click on any math expression to edit it.</p>
          </div>
        </div>
      )}
    </div>
  );
}

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<React.HTMLAttributes<MathfieldElement>, MathfieldElement> & {
        value?: string;
        'virtual-keyboard-mode'?: string;
      };
    }
  }
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    headingOne: { toggleHeadingOne: () => ReturnType; }
    headingTwo: { toggleHeadingTwo: () => ReturnType; }
    headingThree: { toggleHeadingThree: () => ReturnType; }
    headingFour: { toggleHeadingFour: () => ReturnType; }
    headingFive: { toggleHeadingFive: () => ReturnType; }
    headingSix: { toggleHeadingSix: () => ReturnType; }
  }
}
