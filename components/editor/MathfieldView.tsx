'use client';

import React, { useRef, useEffect, useState } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';

// Use a more specific type for math-field or disable any check
interface MathfieldElement extends HTMLElement {
  value: string;
  focus: () => void;
}

export default function MathfieldView({ node, updateAttributes, selected }: NodeViewProps) {
  const mfRef = useRef<MathfieldElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let disposed = false;

    // Import mathlive on client side only
    import('mathlive').then(() => {
      if (disposed || !mfRef.current) return;

      const mathField = mfRef.current;
      mathField.value = node.attrs.latex || '';
      const setTogglesVisible = (visible: boolean) => {
        const toggles = mathField.shadowRoot?.querySelector('.ML__toggles') as HTMLElement | null;
        if (!toggles) return;
        toggles.style.display = visible ? 'flex' : 'none';
      };

      const handleInput = (e: Event) => {
        const target = e.target as MathfieldElement;
        updateAttributes({ latex: target.value });
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
      mathField.addEventListener('focusin', handleFocusIn);
      mathField.addEventListener('focusout', handleFocusOut);
      setTogglesVisible(false);

      // Focus when created if it's empty (likely just inserted)
      if (!node.attrs.latex) {
        setTimeout(() => mathField.focus(), 50);
      }

      cleanup = () => {
        mathField.removeEventListener('input', handleInput);
        mathField.removeEventListener('focusin', handleFocusIn);
        mathField.removeEventListener('focusout', handleFocusOut);
      };
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mfRef.current && mfRef.current.value !== node.attrs.latex) {
      mfRef.current.value = node.attrs.latex || '';
    }
  }, [node.attrs.latex]);

  return (
    <NodeViewWrapper
      data-mathlive-focused={isFocused ? 'true' : 'false'}
      className={`mathfield-shell inline-block align-middle rounded transition-all ${selected ? 'ring-2 ring-blue-400' : 'hover:ring-1 hover:ring-gray-300'}`}
    >
      <math-field
        ref={mfRef}
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
        // This is the attribute to show keyboard on focus
        virtual-keyboard-mode="onfocus"
      />
    </NodeViewWrapper>
  );
}

// Add types for math-field custom element
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<React.HTMLAttributes<MathfieldElement>, MathfieldElement> & {
        'virtual-keyboard-mode'?: string;
      };
    }
  }
}
