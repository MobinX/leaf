import { useState, useEffect } from 'react';
import { Editor } from '@tiptap/react';

export function useEditorStorage(
  editor: Editor | null,
  initialContent: string | undefined,
  onContentChange?: (html: string) => void
) {
  const [editorState, setEditorState] = useState(0);

  // Sync initialContent if it changes from outside
  useEffect(() => {
    if (editor && initialContent !== undefined && initialContent !== editor.getHTML()) {
      const currentHtml = editor.getHTML();
      // Only set content if current is empty or matches the default placeholder
      if (currentHtml === '<p></p>' || currentHtml.includes('Stable Custom H1')) {
        editor.commands.setContent(initialContent);
      }
    }
  }, [editor, initialContent]);

  // Handle document updates and selection state for toolbar
  useEffect(() => {
    if (!editor) return;

    let debounceTimer: NodeJS.Timeout;

    const onSelectionUpdate = () => setEditorState(s => s + 1);

    const onUpdate = () => {
      setEditorState(s => s + 1);
      if (onContentChange) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          onContentChange(editor.getHTML());
        }, 1000);
      }
    };

    editor.on('update', onUpdate);
    editor.on('selectionUpdate', onSelectionUpdate);
    
    return () => {
      editor.off('update', onUpdate);
      editor.off('selectionUpdate', onSelectionUpdate);
      clearTimeout(debounceTimer);
    };
  }, [editor, onContentChange]);

  return { editorState };
}
