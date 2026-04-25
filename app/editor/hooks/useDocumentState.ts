/**
 * useDocumentState hook - manages document lifecycle and persistence
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Document } from '@/lib/types';
import { DocumentStorage } from '@/lib/documentStorage';

const EMPTY_DOCUMENT = (id: string): Document => {
  const initialTabId = 'tab-1';
  return {
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tabs: [{ id: initialTabId, name: 'Tab 1', content: '' }],
    activeTabId: initialTabId,
    inputs: {
      theory: [],
      tables: [],
      calculations: {
        images: [],
        comment: ''
      },
      discussions: {
        images: [],
        comment: ''
      }
    },
    selectedVariants: {
      theory: 0,
      result_discussion: 0
    },
    editorContent: '',
    isGenerating: false
  };
};

export function useDocumentState(documentId: string) {
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load document on mount
  useEffect(() => {
    const load = async () => {
      try {
        const storage = await DocumentStorage.getInstance();
        let doc = await storage.getDocument(documentId);
        
        if (!doc) {
          doc = EMPTY_DOCUMENT(documentId);
        }
        
        setDocument(doc);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document');
        setDocument(EMPTY_DOCUMENT(documentId));
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [documentId]);

  const persistDocument = useCallback(async (doc: Document) => {
    try {
      const storage = await DocumentStorage.getInstance();
      await storage.saveDocument(doc);
    } catch (err) {
      console.error('Failed to save document:', err);
      setError(err instanceof Error ? err.message : 'Failed to save document');
    }
  }, []);

  const updateDocument = useCallback(
    (updates: Partial<Document>) => {
      setDocument(prev => {
        if (!prev) return null;
        const updated = {
          ...prev,
          ...updates,
          updatedAt: new Date().toISOString()
        };

        // Debounce save to IndexedDB
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          persistDocument(updated);
        }, 500);

        return updated;
      });
    },
    [persistDocument]
  );

  const updateInputs = useCallback(
    (section: keyof Document['inputs'] | '_aiComplete', data: any) => {
      setDocument(prev => {
        if (!prev) return null;

        let updated: Document;
        if (section === '_aiComplete') {
          updated = {
            ...prev,
            aiOutput: data.aiOutput,
            editorContent: data.editorContent,
            selectedVariants: data.selectedVariants,
            isGenerating: false,
            updatedAt: new Date().toISOString()
          };
        } else {
          updated = {
            ...prev,
            inputs: {
              ...prev.inputs,
              [section]: data
            },
            updatedAt: new Date().toISOString()
          };
        }

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          persistDocument(updated);
        }, 500);

        return updated;
      });
    },
    [persistDocument]
  );

  const setEditorContent = useCallback(
    (content: string) => {
      updateDocument({ editorContent: content });
    },
    [updateDocument]
  );

  const updateTabContent = useCallback(
    (tabId: string, content: string) => {
      setDocument(prev => {
        if (!prev) return null;
        const updated = {
          ...prev,
          tabs: prev.tabs.map(t => t.id === tabId ? { ...t, content } : t),
          updatedAt: new Date().toISOString()
        };

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          persistDocument(updated);
        }, 500);

        return updated;
      });
    },
    [persistDocument]
  );

  return {
    document,
    isLoading,
    error,
    updateDocument,
    updateInputs,
    setEditorContent,
    updateTabContent,
    clearError: () => setError(null)
  };
}
