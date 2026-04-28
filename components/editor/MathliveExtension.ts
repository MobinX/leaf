import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import MathfieldView from './MathfieldView';

export const MathliveExtension = Node.create({
  name: 'mathlive',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (element) => {
          return element.getAttribute('data-latex') || element.textContent || '';
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'math',
      },
      {
        tag: 'math-field',
      }
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['math', mergeAttributes(HTMLAttributes, { 'data-latex': node.attrs.latex || '' }), node.attrs.latex || ''];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathfieldView);
  },

  addCommands() {
    return {
      insertMath: (latex: string = '') => ({ chain }) => {
        return chain()
          .insertContent({
            type: this.name,
            attrs: { latex },
          })
          .focus()
          .run();
      },
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathlive: {
      insertMath: (latex?: string) => ReturnType;
    };
  }
}
