import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance, hideAll } from 'tippy.js';
import Fuse from 'fuse.js';
import { getAllCommandList } from '@/lib/editorCommands';
import CommandList from './CommandList';

import 'tippy.js/dist/tippy.css';

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        items: ({ query, editor }) => {
          const allCommands = getAllCommandList(editor);
          
          if (!query) {
            return allCommands.slice(0, 10);
          }

          const fuse = new Fuse(allCommands, {
            keys: ['title', 'category'],
            threshold: 0.4,
            distance: 100,
          });

          return fuse.search(query).map(result => result.item).slice(0, 10);
        },
        command: ({ editor, range, props }) => {
          props.command(range);
        },
        render: () => {
          let component: ReactRenderer<any>;
          let popup: Instance;

          return {
            onStart: (props) => {
              component = new ReactRenderer(CommandList, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) {
                return;
              }

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect as any,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                zIndex: 9999,
                arrow: false,
                duration: [0, 0],
              })[0];
            },

            onUpdate(props) {
              component.updateProps(props);

              if (popup) {
                popup.setProps({
                  getReferenceClientRect: props.clientRect as any,
                });
              }
            },

            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                if (popup) {
                  popup.hide();
                }
                return true;
              }

              return (component.ref as any)?.onKeyDown(props);
            },

            onExit() {
              hideAll();
              if (popup) {
                popup.destroy();
              }
              if (component) {
                component.destroy();
              }
            },
          };
        },
      }),
    ];
  },
});
