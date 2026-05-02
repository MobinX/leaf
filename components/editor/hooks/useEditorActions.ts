import { useState, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { LAB_REPORT_PROMPT_TEXT } from '../constants';

export function useEditorActions(
  editor: Editor | null,
  addStoredImage: (src: string) => void
) {
  const [showHtmlView, setShowHtmlView] = useState(false);
  const [htmlOutput, setHtmlOutput] = useState('');
  const [htmlDirty, setHtmlDirty] = useState(false);
  const [isPromptCopied, setIsPromptCopied] = useState(false);

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

  const copyLabPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(LAB_REPORT_PROMPT_TEXT);
      setIsPromptCopied(true);
      window.setTimeout(() => setIsPromptCopied(false), 1500);
    } catch (error) {
      console.error('Failed to copy lab prompt text', error);
    }
  }, []);

  return {
    showHtmlView,
    htmlOutput,
    setHtmlOutput,
    htmlDirty,
    setHtmlDirty,
    isPromptCopied,
    insertImageFromUrl,
    insertStoredImage,
    onUploadImage,
    handleToggleHtmlView,
    handlePrintClick,
    copyLabPrompt
  };
}
