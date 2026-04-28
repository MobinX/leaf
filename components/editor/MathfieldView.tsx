'use client';

import React, { useRef, useEffect, useState } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';

// Use a more specific type for math-field or disable any check
interface MathfieldElement extends HTMLElement {
  value: string;
  focus: () => void;
}

export default function MathfieldView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const mfRef = useRef<MathfieldElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isMathliveLoaded, setIsMathliveLoaded] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    
    // Import mathlive on client side
    import('mathlive').then(() => {
      setIsMathliveLoaded(true);
      if (!mfRef.current) return;

      const mathField = mfRef.current;
      
      // Ensure the value is set after mathlive is loaded
      if (mathField.value !== node.attrs.latex) {
        mathField.value = node.attrs.latex || '';
      }

      const setTogglesVisible = (visible: boolean) => {
        const toggles = mathField.shadowRoot?.querySelector('.ML__toggles') as HTMLElement | null;
        if (!toggles) return;
        toggles.style.display = visible ? 'flex' : 'none';
      };

      const handleInput = (e: Event) => {
        const target = e.target as MathfieldElement;
        updateAttributes({ latex: target.value });
      };

      const handleKeyDown = (e: KeyboardEvent) => {
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

      const handleFocusIn = () => {
        setIsFocused(true);
        setTogglesVisible(true);
      };
      const handleFocusOut = () => {
        setIsFocused(false);
        setTogglesVisible(false);
      };

      mathField.addEventListener('input', handleInput);
      mathField.addEventListener('keydown', handleKeyDown, true);
      mathField.addEventListener('focusin', handleFocusIn);
      mathField.addEventListener('focusout', handleFocusOut);
      setTogglesVisible(false);

      // Focus when created if it's empty and editor is focused (likely just inserted)
      if (!node.attrs.latex && editor.isFocused) {
        setTimeout(() => {
          if (mfRef.current) mfRef.current.focus();
        }, 50);
      }

      cleanup = () => {
        mathField.removeEventListener('input', handleInput);
        mathField.removeEventListener('keydown', handleKeyDown, true);
        mathField.removeEventListener('focusin', handleFocusIn);
        mathField.removeEventListener('focusout', handleFocusOut);
      };
    });

    return () => {
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync value when node attributes change, but only if mathlive is ready
  useEffect(() => {
    if (isMathliveLoaded && mfRef.current && mfRef.current.value !== node.attrs.latex) {
      mfRef.current.value = node.attrs.latex || '';
    }
  }, [node.attrs.latex, isMathliveLoaded]);

  return (
    <NodeViewWrapper
      data-mathlive-focused={isFocused ? 'true' : 'false'}
      className={`mathfield-shell inline-block align-middle rounded transition-all ${selected ? 'ring-2 ring-blue-400' : 'hover:ring-1 hover:ring-gray-300'}`}
    >
      <math-field
        ref={mfRef}
        value={node.attrs.latex || ''}
        style={{
          border: 'none',
          padding: '2px 4px',
          minWidth: '24px',
          background: 'transparent',
          outline: 'none',
          fontSize: 'inherit',
          display: 'inline-block',
          verticalAlign: 'middle'
        }}
        virtual-keyboard-mode="onfocus"
      />
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
      };
    }
  }
}
