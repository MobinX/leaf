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
          // If it's <math>latex</math>, element.textContent is what we want
          return element.textContent || '';
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'math',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    // This defines how it is saved/exported to HTML
    return ['math', mergeAttributes(HTMLAttributes), node.attrs.latex || ''];
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
