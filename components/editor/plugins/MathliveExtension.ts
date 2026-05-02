import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { EditorView, NodeView } from '@tiptap/pm/view';
import { Node as PMNode } from '@tiptap/pm/model';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Type for MathfieldElement
interface MathfieldElement extends HTMLElement {
  value: string;
  focus: () => void;
  blur: () => void;
  hasFocus: () => boolean;
  setOptions: (options: Record<string, unknown>) => void;
  executeCommand: (command: string) => void;
}

class MathNodeView implements NodeView {
  dom: HTMLElement;
  container: HTMLElement;
  node: PMNode;
  view: EditorView;
  getPos: () => number;
  isEditing: boolean = false;
  mf?: MathfieldElement;

  constructor(node: PMNode, view: EditorView, getPos: () => number) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement('span');
    this.dom.classList.add('mathlive-node', 'inline-block', 'align-middle', 'rounded', 'transition-all', 'cursor-pointer', 'px-1', 'py-0.5');
    this.dom.style.display = 'inline-block';
    this.dom.style.verticalAlign = 'middle';
    
    this.container = document.createElement('span');
    this.dom.appendChild(this.container);

    this.dom.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.isEditing) {
        this.renderEditable();
      }
    });

    this.renderStatic();
    
    // Auto-edit if empty latex and editor is focused
    if (!this.node.attrs.latex && this.view.editable) {
       setTimeout(() => {
         if (this.view.hasFocus()) {
           this.renderEditable();
         }
       }, 50);
    }
  }

  renderStatic() {
    this.isEditing = false;
    this.container.innerHTML = '';
    const latex = this.node.attrs.latex || '\\text{?}';
    const span = document.createElement('span');
    span.className = 'rendered-math tiptap-mathematics-render';
    try {
      span.innerHTML = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false,
      });
    } catch {
      span.textContent = latex;
    }
    this.container.appendChild(span);
    this.dom.classList.remove('ring-2', 'ring-blue-400');
  }

  async renderEditable() {
    if (!this.view.editable) return;
    if (this.isEditing) return;
    
    this.isEditing = true;
    this.container.innerHTML = '';
    this.dom.classList.add('ring-2', 'ring-blue-400');
    
    // Ensure mathlive is loaded
    if (typeof window !== 'undefined') {
        // We use a dynamic import to avoid SSR issues
        await import('mathlive');
    }

    const mf = document.createElement('math-field') as MathfieldElement;
    mf.value = this.node.attrs.latex || '';
    mf.style.border = 'none';
    mf.style.padding = '0px 2px';
    mf.style.minWidth = '2rem';
    mf.style.background = 'transparent';
    mf.style.outline = 'none';
    mf.style.display = 'inline-block';
    mf.style.verticalAlign = 'middle';
    mf.style.fontSize = 'inherit';
    
    mf.setOptions({
        virtualKeyboardMode: 'onfocus',
    });

    mf.addEventListener('input', (e) => {
      const newValue = (e.target as MathfieldElement).value;
      if (this.node.attrs.latex !== newValue) {
        const pos = this.getPos();
        this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, undefined, {
            ...this.node.attrs,
            latex: newValue
        }));
      }
    });

    const handleBlur = () => {
      // Use a small timeout to check if focus really left the math-field
      setTimeout(() => {
        if (this.mf && !this.mf.hasFocus() && this.isEditing) {
          this.renderStatic();
        }
      }, 200);
    };

    mf.addEventListener('focusout', handleBlur);

    this.container.appendChild(mf);
    this.mf = mf;
    
    // Focus the math-field
    setTimeout(() => mf.focus(), 10);
  }

  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    const oldLatex = this.node.attrs.latex;
    this.node = node;
    
    if (this.node.attrs.latex !== oldLatex) {
        if (this.isEditing && this.mf && this.mf.value !== this.node.attrs.latex) {
            this.mf.value = this.node.attrs.latex;
        } else if (!this.isEditing) {
            this.renderStatic();
        }
    }
    return true;
  }

  selectNode() {
    this.dom.classList.add('ring-2', 'ring-blue-400');
  }

  deselectNode() {
    if (!this.isEditing) {
      this.dom.classList.remove('ring-2', 'ring-blue-400');
    }
  }

  stopEvent(event: Event) {
    const target = event.target as HTMLElement;
    return !!target.closest('math-field');
  }

  ignoreMutation() {
    return true;
  }
  
  destroy() {
    this.mf = undefined;
  }
}

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

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('mathlive'),
        props: {
          nodeViews: {
            mathlive: (node, view, getPos) => new MathNodeView(node, view, getPos as () => number),
          },
        },
      }),
    ];
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
