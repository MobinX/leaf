import { useState, useCallback } from 'react';
import { Editor } from '@tiptap/react';

export function useEditorActions(
  editor: Editor | null,
  addStoredImage: (src: string) => void
) {
  const [showHtmlView, setShowHtmlView] = useState(false);
  const [htmlOutput, setHtmlOutput] = useState('');
  const [htmlDirty, setHtmlDirty] = useState(false);

  const insertImageFromUrl = useCallback((url: string) => {
    const src = url.trim();
    if (!src) return;
    editor?.chain().focus().setImage({ src }).run();
  }, [editor]);

  const insertStoredImage = useCallback((src: string) => {
    editor?.chain().focus().setImage({ src }).run();
  }, [editor]);

  const onUploadImage = useCallback<React.ChangeEventHandler<HTMLInputElement>>((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const src = reader.result;
      editor?.chain().focus().setImage({ src }).run();
      addStoredImage(src);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }, [editor, addStoredImage]);

  const handleToggleHtmlView = useCallback(() => {
    if (!showHtmlView) {
      setHtmlOutput(editor?.getHTML() ?? '');
      setHtmlDirty(false);
      setShowHtmlView(true);
      return;
    }
    if (htmlDirty) {
      editor?.commands.setContent(htmlOutput);
    }
    setHtmlDirty(false);
    setShowHtmlView(false);
  }, [editor, showHtmlView, htmlDirty, htmlOutput]);

  const handlePrintClick = useCallback(() => {
    if (showHtmlView) {
      if (htmlDirty) {
        editor?.commands.setContent(htmlOutput);
        setHtmlDirty(false);
      }
      setShowHtmlView(false);
      requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
      return;
    }
    window.print();
  }, [editor, showHtmlView, htmlDirty, htmlOutput]);

  return {
    showHtmlView,
    htmlOutput,
    setHtmlOutput,
    htmlDirty,
    setHtmlDirty,
    insertImageFromUrl,
    insertStoredImage,
    onUploadImage,
    handleToggleHtmlView,
    handlePrintClick,
  };
}
