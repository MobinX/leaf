'use client';

import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useDocumentState } from '@/app/editor/hooks/useDocumentState';
import TabBar from '@/components/editor/TabBar';
import { useCallback } from 'react';

const TiptapEditor = dynamic(() => import('@/components/editor/TiptapEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="text-lg font-medium text-gray-600 animate-pulse">Loading editor...</div>
    </div>
  ),
});

export default function DynamicEditorPage() {
  const params = useParams();
  const documentName = decodeURIComponent(params.name as string);
  const { isLoading, document, updateDocument, updateTabContent } = useDocumentState(documentName);

  const handleTabChange = useCallback((tabId: string) => {
    updateDocument({ activeTabId: tabId });
  }, [updateDocument]);

  const handleAddTab = useCallback(() => {
    const newTabId = `tab-${Date.now()}`;
    updateDocument({
      tabs: [...(document?.tabs || []), {
        id: newTabId,
        name: `Tab ${(document?.tabs.length || 0) + 1}`,
        content: ''
      }],
      activeTabId: newTabId
    });
  }, [document?.tabs, updateDocument]);

  const handleCloneTab = useCallback(() => {
    if (!document) return;
    const activeTab = document.tabs.find(t => t.id === document.activeTabId);
    if (!activeTab) return;

    const newTabId = `tab-${Date.now()}`;
    updateDocument({
      tabs: [...document.tabs, {
        id: newTabId,
        name: `${activeTab.name} (Copy)`,
        content: activeTab.content
      }],
      activeTabId: newTabId
    });
  }, [document, updateDocument]);

  const handleContentChange = useCallback((tabId: string, content: string) => {
    updateTabContent(tabId, content);
  }, [updateTabContent]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-lg font-medium text-gray-600 animate-pulse">Loading document...</div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-lg font-medium text-red-600">Failed to load document</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 pb-12">
      {document.tabs.map((tab) => (
        <div 
          key={tab.id} 
          className={tab.id === document.activeTabId ? 'block' : 'hidden'}
        >
          <TiptapEditor 
            documentId={documentName}
            initialContent={tab.content}
            onContentChange={(content) => handleContentChange(tab.id, content)}
          />
        </div>
      ))}
      <TabBar
        tabs={document.tabs}
        activeTabId={document.activeTabId}
        onTabChange={handleTabChange}
        onAddTab={handleAddTab}
        onCloneTab={handleCloneTab}
      />
    </main>
  );
}
