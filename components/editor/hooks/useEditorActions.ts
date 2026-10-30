import { useState, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from '@/lib/pageSize';
import { printWithPagination } from '@/lib/export/print';

export function useEditorActions(
  editor: Editor | null,
  addStoredImage: (src: string) => void,
  pageSettings?: PageSettings
) {
  const [showHtmlView, setShowHtmlView] = useState(false);
  const [htmlOutput, setHtmlOutput] = useState('');
  const [htmlDirty, setHtmlDirty] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

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

  /**
   * Prints the document.
   *
   * The document is laid out with real page breaks first, so the printed
   * sheet matches the exported files instead of the editor's virtual
   * dividers.
   */
  const handlePrintClick = useCallback(() => {
    const run = async () => {
      if (showHtmlView) {
        if (htmlDirty) {
          editor?.commands.setContent(htmlOutput);
          setHtmlDirty(false);
        }
        setShowHtmlView(false);
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
      }

      if (!editor) {
        window.print();
        return;
      }

      setIsPrinting(true);
      try {
        await printWithPagination({
          editor,
          pageSettings: pageSettings ?? DEFAULT_PAGE_SETTINGS,
        });
      } finally {
        setIsPrinting(false);
      }
    };

    void run();
  }, [editor, showHtmlView, htmlDirty, htmlOutput, pageSettings]);

  return {
    showHtmlView,
    htmlOutput,
    setHtmlOutput,
    htmlDirty,
    setHtmlDirty,
    isPrinting,
    insertImageFromUrl,
    insertStoredImage,
    onUploadImage,
    handleToggleHtmlView,
    handlePrintClick,
  };
}
