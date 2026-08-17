'use client';

import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useDocumentState } from '@/app/editor/hooks/useDocumentState';
import TabBar from '@/components/editor/TabBar';
import { useCallback, useMemo } from 'react';

const TiptapEditor = dynamic(() => import('@/components/editor/TiptapEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="text-lg font-medium text-gray-600 animate-pulse">Loading editor...</div>
    </div>
  ),
});

const SERVER_URL = process.env.NEXT_PUBLIC_YJS_SERVER || 'wss://obscure-zebra-qp64x595ggjc677x-1234.app.github.dev';

const COLLAB_COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990'];

/**
 * Returns a stable per-browser collaborator identity (persisted in localStorage)
 * so the same user keeps their name/color across reloads.
 */
function getCollaborator() {
  if (typeof window === 'undefined') {
    return { name: 'Guest', color: COLLAB_COLORS[0] };
  }
  try {
    const stored = localStorage.getItem('leaf-collab-user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.name && parsed?.color) return parsed;
    }
  } catch {
    // fall through to generation
  }
  const user = {
    name: `User-${Math.floor(Math.random() * 10000)}`,
    color: COLLAB_COLORS[Math.floor(Math.random() * COLLAB_COLORS.length)],
  };
  try {
    localStorage.setItem('leaf-collab-user', JSON.stringify(user));
  } catch {
    // storage may be unavailable; fine to ignore
  }
  return user;
}

export default function DynamicEditorPage() {
  const params = useParams();
  const documentName = decodeURIComponent(params.name as string);
  const { isLoading, document, updateDocument, updateTabContent } = useDocumentState(documentName);
  const collaborator = useMemo(() => getCollaborator(), []);

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
      <div className="flex items-center justify-center h-screen bg-[var(--bg-app)]">
        <div className="text-lg font-medium text-[var(--fg-toolbar)] animate-pulse">Loading document...</div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-app)]">
        <div className="text-lg font-medium text-red-600">Failed to load document</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg-app)]">
      {document.tabs.map((tab) => (
        <div 
          key={tab.id} 
          className={tab.id === document.activeTabId ? 'block' : 'hidden'}
        >
          <TiptapEditor 
            initialContent={tab.content}
            onContentChange={(content) => handleContentChange(tab.id, content)}
            collaboration={{
              serverUrl: SERVER_URL,
              // The room is derived from the document name + tab NAME (which is
              // the same across browsers), so two people editing the same
              // document/tab sync with each other.
              room: `${documentName}/${tab.name}`,
              userName: collaborator.name,
              userColor: collaborator.color,
            }}
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
