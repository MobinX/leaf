'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Use a more specific type for math-field or disable any check
interface MathfieldElement extends HTMLElement {
  value: string;
  focus: () => void;
  blur: () => void;
  hasFocus: () => boolean;
  setOptions: (options: any) => void;
}

export default function MathfieldView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const mfRef = useRef<MathfieldElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Sync latex with attributes
  const latex = node.attrs.latex || '';

  // Rendered KaTeX HTML
  const renderedHtml = useMemo(() => {
    try {
      return katex.renderToString(latex || '\\text{?}', {
        throwOnError: false,
        displayMode: false,
      });
    } catch (e) {
      console.error('KaTeX error:', e);
      return latex;
    }
  }, [latex]);

  useEffect(() => {
    if (isEditing) {
      // Import mathlive on client side when editing starts
      import('mathlive').then(() => {
        if (!mfRef.current) return;

        const mathField = mfRef.current;
        
        // Configure mathfield
        mathField.setOptions({
          virtualKeyboardMode: 'onfocus',
        });
        
        if (mathField.value !== latex) {
          mathField.value = latex;
        }

        const handleInput = (e: Event) => {
          const target = e.target as MathfieldElement;
          updateAttributes({ latex: target.value });
        };

        const handleBlur = (e: FocusEvent) => {
          // If the focus is moving to something inside the mathfield or the virtual keyboard, don't stop editing
          const relatedTarget = e.relatedTarget as HTMLElement;
          if (
            relatedTarget && 
            (relatedTarget.closest('math-field') || 
             relatedTarget.closest('.ML__keyboard') || 
             relatedTarget.tagName.includes('VIRTUAL-KEYBOARD'))
          ) {
            return;
          }

          // Small delay to allow for focus to move between internal elements
          setTimeout(() => {
            if (mfRef.current && !mfRef.current.hasFocus()) {
              setIsEditing(false);
            }
          }, 150);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
            setIsEditing(false);
            return;
          }
          
          const key = e.key.toLowerCase();
          const hasPrimary = e.metaKey || e.ctrlKey;
          if (!hasPrimary || e.altKey) return;

          const isUndo = key === 'z' && !e.shiftKey;
          const isRedo = (key === 'z' && e.shiftKey) || key === 'y';
          if (!isUndo && !isRedo) return;

          e.preventDefault();
          e.stopPropagation();
          if (isUndo) editor.commands.undo();
          if (isRedo) editor.commands.redo();
        };

        mathField.addEventListener('input', handleInput);
        mathField.addEventListener('focusout', handleBlur);
        mathField.addEventListener('keydown', handleKeyDown, true);

        // Focus the mathfield
        setTimeout(() => {
          mathField.focus();
        }, 50);

        return () => {
          mathField.removeEventListener('input', handleInput);
          mathField.removeEventListener('focusout', handleBlur);
          mathField.removeEventListener('keydown', handleKeyDown, true);
        };
      });
    }
  }, [isEditing, editor, updateAttributes, latex]);

  // Handle click to start editing
  const handleContainerClick = () => {
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  // Auto-focus on insertion if empty
  useEffect(() => {
    if (latex === '' && !isEditing) {
      setIsEditing(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-focus on insertion if empty (alternate check)
  useEffect(() => {
    if (!node.attrs.latex && editor.isFocused && !isEditing) {
      const timer = setTimeout(() => {
        setIsEditing(true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [node.attrs.latex, editor.isFocused, isEditing]);

  // Click outside listener
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        containerRef.current && 
        !containerRef.current.contains(target) && 
        !target.closest('.ML__keyboard') &&
        !target.tagName.includes('VIRTUAL-KEYBOARD')
      ) {
        setIsEditing(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing]);

  return (
    <NodeViewWrapper
      ref={containerRef}
      data-mathlive-focused={isEditing ? 'true' : 'false'}
      className={`mathfield-shell inline-block align-middle rounded transition-all cursor-pointer ${
        selected ? 'ring-2 ring-blue-400' : 'hover:ring-1 hover:ring-gray-300'
      }`}
      onClick={handleContainerClick}
    >
      {isEditing ? (
        <math-field
          ref={mfRef}
          style={{
            border: 'none',
            padding: '2px 4px',
            minWidth: '2.5rem',
            background: 'transparent',
            outline: 'none',
            fontSize: 'inherit',
            display: 'inline-block',
            verticalAlign: 'middle'
          }}
        />
      ) : (
        <span 
          className="rendered-math tiptap-mathematics-render px-1 py-0.5"
          dangerouslySetInnerHTML={{ __html: renderedHtml }} 
        />
      )}
    </NodeViewWrapper>
  );
}

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<React.HTMLAttributes<MathfieldElement>, MathfieldElement> & {
        value?: string;
        'virtual-keyboard-mode'?: string;
        'menu-toggle'?: string;
        'keyboard-toggle'?: string;
      };
    }
  }
}
