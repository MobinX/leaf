import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import { cn } from '@/lib/utils';
import * as Popover from '@radix-ui/react-popover';
import {
  Bold, Italic, Underline, List, ListOrdered,
  Heading, Quote as QuoteIcon,
  Strikethrough, Subscript as SubscriptIcon, Superscript as SuperscriptIcon
} from 'lucide-react';

interface VerticalToolbarProps {
  editor: Editor;
}

const MenuButton = ({ 
  onClick, 
  isActive = false, 
  children,
  title,
  className
}: { 
  onClick: () => void; 
  isActive?: boolean; 
  children: React.ReactNode; 
  title: string; 
  className?: string;
}) => (
  <button
    type="button"
    onClick={(e) => { e.preventDefault(); onClick(); }}
    title={title}
    className={cn(
      "w-7 h-7 rounded-lg transition-all flex items-center justify-center shrink-0 border",
      isActive 
        ? "bg-blue-100 text-blue-700 border-blue-200 shadow-sm" 
        : "bg-white text-gray-500 border-transparent hover:bg-gray-100 hover:text-gray-900",
      className
    )}
  >
    {children}
  </button>
);

export const VerticalToolbar = ({ editor }: VerticalToolbarProps) => {
  const [showHeadings, setShowHeadings] = useState(false);

  if (!editor) return null;

  const headingOptions = [1, 2, 3, 4, 5, 6] as const;
  const activeHeading = headingOptions.find(level => editor.isActive('heading', { level }));

  return (
    <div className="fixed left-4 top-1/2 -translate-y-1/2 z-40 bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl shadow-xl p-1.5 flex flex-col gap-1 w-12 items-center animate-in fade-in slide-in-from-left-4 duration-500">
      {/* Headings Popover */}
      <Popover.Root open={showHeadings} onOpenChange={setShowHeadings}>
        <Popover.Trigger asChild>
          <button 
            title="Headings"
            className={cn(
              "w-7 h-7 rounded-lg transition-all flex flex-col items-center justify-center border shrink-0",
              showHeadings || activeHeading
                ? "bg-blue-50 text-blue-700 border-blue-100" 
                : "bg-white text-gray-500 border-transparent hover:bg-gray-100"
            )}
          >
            <div className="relative flex items-center justify-center">
              <Heading size={18} strokeWidth={2.5} />
              {activeHeading && (
                <span className="absolute -right-2.5 -top-1.5 bg-blue-600 text-white text-[8px] px-1 rounded-full font-black scale-90">
                  {activeHeading}
                </span>
              )}
            </div>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content 
            side="right" 
            sideOffset={16} 
            className="bg-white border border-gray-100 rounded-2xl shadow-2xl p-2 z-[100] flex gap-1.5 animate-in fade-in slide-in-from-left-2 duration-300 ring-1 ring-black/5"
          >
            {headingOptions.map(level => (
              <button 
                key={level}
                onClick={(e) => { 
                  e.preventDefault(); 
                  editor.chain().focus().toggleHeading({ level }).run(); 
                  setShowHeadings(false); 
                }}
                className={cn(
                  "w-10 h-10 flex items-center justify-center text-sm font-bold rounded-xl transition-all border shrink-0",
                  editor.isActive('heading', { level }) 
                    ? "bg-blue-600 text-white border-blue-700 shadow-md scale-105" 
                    : "bg-gray-50 text-gray-600 border-transparent hover:bg-gray-200 hover:text-gray-900"
                )}
              >
                H{level}
              </button>
            ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <div className="w-8 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-1" />

      {/* Basic Formatting */}
      <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold (Ctrl+B / Cmd+B)"><Bold size={19} /></MenuButton>
      <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic (Ctrl+I / Cmd+I)"><Italic size={19} /></MenuButton>
      <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline (Ctrl+U / Cmd+U)"><Underline size={19} /></MenuButton>
      <MenuButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strikethrough (Ctrl+Shift+S / Cmd+Shift+S)"><Strikethrough size={19} /></MenuButton>
      <MenuButton onClick={() => editor.chain().focus().toggleSubscript().run()} isActive={editor.isActive('subscript')} title="Subscript (Ctrl+, / Cmd+,)"><SubscriptIcon size={19} /></MenuButton>
      <MenuButton onClick={() => editor.chain().focus().toggleSuperscript().run()} isActive={editor.isActive('superscript')} title="Superscript (Ctrl+. / Cmd+.)"><SuperscriptIcon size={19} /></MenuButton>
      
     
      {/* Lists & Quotes */}
      <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List (Ctrl+Shift+8 / Cmd+Shift+8)"><List size={19} /></MenuButton>
      <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Ordered List (Ctrl+Shift+7 / Cmd+Shift+7)"><ListOrdered size={19} /></MenuButton>
      <MenuButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Blockquote (Ctrl+Shift+B / Cmd+Shift+B)"><QuoteIcon size={19} /></MenuButton>
      
      <div className="w-8 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-1" />

      {/* Code */}
       </div>
  );
};
