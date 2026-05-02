'use client';

import React, { useEffect, useState } from 'react';
import { Editor } from '@tiptap/react';
import { 
  Bold, Italic, Underline, List, ListOrdered, 
  Redo, Undo, Table, Sigma, 
  Heading1, Heading2, Code, Image as ImageIcon,
  Strikethrough, Link as LinkIcon, Quote as QuoteIcon,
  CodeXml
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
  className?: string;
}

const MenuButton = ({ 
  onClick, 
  isActive = false, 
  disabled = false, 
  children,
  title,
  className
}: MenuButtonProps) => (
  <button
    type="button"
    onClick={(e) => {
      e.preventDefault();
      onClick();
    }}
    disabled={disabled}
    title={title}
    className={cn(
      "p-2 rounded-md transition-all flex items-center justify-center shrink-0 min-w-[36px] min-h-[36px] border",
      isActive 
        ? "bg-blue-600 text-white border-blue-700 shadow-inner scale-95" 
        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100 active:bg-gray-200",
      disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer",
      className
    )}
  >
    <span className={cn("flex items-center justify-center", isActive ? "text-white" : "text-gray-700")}>
      {children}
    </span>
  </button>
);

export default function MenuBar({ editor }: { editor: Editor | null }) {
  // Use a local state to force re-render on editor changes if needed
  const [, setUpdate] = useState(0);

  useEffect(() => {
    if (!editor) return;

    const updateHandler = () => {
      setUpdate(s => s + 1);
    };

    editor.on('transaction', updateHandler);
    editor.on('selectionUpdate', updateHandler);

    return () => {
      editor.off('transaction', updateHandler);
      editor.off('selectionUpdate', updateHandler);
    };
  }, [editor]);

  if (!editor) return <div className="h-[50px] bg-gray-50 animate-pulse" />;

  const addLink = () => {
    const url = window.prompt('Enter URL');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-2 py-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth">
      <MenuButton 
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo size={18} />
      </MenuButton>
      <MenuButton 
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo size={18} />
      </MenuButton>
      
      <div className="w-[1px] h-6 bg-gray-300 mx-1 shrink-0" />

      <MenuButton 
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold"
      >
        <Bold size={18} />
      </MenuButton>
      <MenuButton 
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic"
      >
        <Italic size={18} />
      </MenuButton>
      <MenuButton 
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Underline"
      >
        <Underline size={18} />
      </MenuButton>
      <MenuButton 
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Strike"
      >
        <Strikethrough size={18} />
      </MenuButton>

      <div className="w-[1px] h-6 bg-gray-300 mx-1 shrink-0" />

      <MenuButton 
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <Heading1 size={18} />
      </MenuButton>
      <MenuButton 
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 size={18} />
      </MenuButton>

      <div className="w-[1px] h-6 bg-gray-300 mx-1 shrink-0" />

      <MenuButton 
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <List size={18} />
      </MenuButton>
      <MenuButton 
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Ordered List"
      >
        <ListOrdered size={18} />
      </MenuButton>
      <MenuButton 
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Quote"
      >
        <QuoteIcon size={18} />
      </MenuButton>

      <div className="w-[1px] h-6 bg-gray-300 mx-1 shrink-0" />

      <MenuButton 
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        title="Code"
      >
        <Code size={18} />
      </MenuButton>
      <MenuButton 
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title="Code Block"
      >
        <CodeXml size={18} />
      </MenuButton>

      <div className="w-[1px] h-6 bg-gray-300 mx-1 shrink-0" />

      <MenuButton 
        onClick={addLink}
        isActive={editor.isActive('link')}
        title="Add Link"
      >
        <LinkIcon size={18} />
      </MenuButton>

      <MenuButton 
        onClick={() => {
            const url = window.prompt('Enter image URL');
            if (url) editor.chain().focus().setImage({ src: url }).run();
        }}
        title="Image"
      >
        <ImageIcon size={18} />
      </MenuButton>

      <MenuButton 
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        title="Insert Table"
      >
        <Table size={18} />
      </MenuButton>

      <div className="w-[1px] h-6 bg-gray-300 mx-1 shrink-0" />

      <MenuButton 
        onClick={() => editor.chain().focus().insertMath().run()}
        title="Math Formula (Sigma)"
        isActive={editor.isActive('mathlive')}
        className={cn(
          "ml-2",
          editor.isActive('mathlive') 
            ? "bg-blue-700 text-white shadow-md border-blue-800" 
            : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm border-blue-700"
        )}
      >
        <Sigma size={18} />
      </MenuButton>
    </div>
  );
}
