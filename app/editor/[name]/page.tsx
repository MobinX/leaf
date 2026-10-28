'use client';

import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useDocumentState } from '@/app/editor/hooks/useDocumentState';
import TabBar from '@/components/editor/TabBar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { decodeDocFromD1 } from '@/lib/yjsDocStore';
import { loadDocTab } from '@/lib/teamApi';
import { formatSyncStatus } from '@/lib/docSyncStatus';
import type { DocSyncState } from '@/components/editor/hooks/useD1DocumentSync';
import AuthButton from '@/components/team/AuthButton';
import InboxBell from '@/components/team/InboxBell';
import EditorsPanel from '@/components/team/EditorsPanel';
import ShareLinks from '@/components/team/ShareLinks';

const TiptapEditor = dynamic(() => import('@/components/editor/TiptapEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="text-lg font-medium text-gray-600 animate-pulse">Loading editor...</div>
    </div>
  ),
});

/**
 * Optional override for the collaboration endpoint base URL (e.g. a standalone
 * collab Worker). When unset, the editor connects same-origin to
 * `/collab/rooms`, which is served by the app Worker itself.
 */
const SERVER_URL = process.env.NEXT_PUBLIC_YJS_SERVER?.trim() || undefined;

const COLLAB_COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990'];

const SYNC_DOT: Record<string, string> = {
  neutral: '#9ca3af',
  active: '#d97706',
  done: '#16a34a',
  failed: '#dc2626',
};

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
  const { user, loading: authLoading } = useAuth();
  const [showEditors, setShowEditors] = useState(false);
  // Latest save state per tab, reported up by each TiptapEditor.
  const [syncMap, setSyncMap] = useState<Record<string, DocSyncState>>({});
  // Incremented by the header Save button; every editor saves on change.
  const [saveCounter, setSaveCounter] = useState(0);
  const handleSync = useCallback((tabName: string, s: DocSyncState) => {
    setSyncMap((prev) => {
      const cur = prev[tabName];
      if (cur && cur.status === s.status && cur.lastSavedAt === s.lastSavedAt) return prev;
      return { ...prev, [tabName]: s };
    });
  }, []);
  // D1 seeds, one Yjs snapshot per tab, applied to each fresh Y.Doc before it
  // connects. Loaded once per document open (after auth resolves) so the
  // editors mount with the stored state exactly once.
  const [seeds, setSeeds] = useState<Record<string, Uint8Array | null>>({});
  const [seedsReady, setSeedsReady] = useState(false);
  const fetchedTabs = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!document || authLoading) return;
    // Signed-out readers load with no identity: the seed fetch fails closed
    // to null and the editor mounts with local/live content instead.
    let cancelled = false;
    const missing = document.tabs.map((t) => t.name).filter((n) => !fetchedTabs.current.has(n));
    void (async () => {
      const entries: Record<string, Uint8Array | null> = {};
      for (const name of missing) {
        fetchedTabs.current.add(name);
        try {
          const res = await loadDocTab(user, documentName, name);
          entries[name] =
            res && "stateB64" in res && res.stateB64
              ? await decodeDocFromD1(res.stateB64)
              : null;
        } catch {
          entries[name] = null;
        }
      }
      if (!cancelled) {
        setSeeds((prev) => ({ ...prev, ...entries }));
        setSeedsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [document, documentName, user, authLoading]);
  const guest = useMemo(() => getCollaborator(), []);
  const collaborator = useMemo(() => {
    if (user) {
      let hash = 0;
      for (let i = 0; i < user.email.length; i += 1) {
        hash = (hash * 31 + user.email.charCodeAt(i)) | 0;
      }
      return {
        name: user.name,
        color: COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length],
      };
    }
    return guest;
  }, [user, guest]);

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

  // Wait for the D1 snapshots so every Y.Doc is seeded before it connects.
  if (!seedsReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-app)]">
        <div className="text-lg font-medium text-[var(--fg-toolbar)] animate-pulse">Loading shared document...</div>
      </div>
    );
  }

  const activeTabName = document.tabs.find((t) => t.id === document.activeTabId)?.name ?? "";
  const activeSync = formatSyncStatus(
    syncMap[activeTabName] ?? { status: "idle", lastSavedAt: null },
  );
  const saveBusy = activeSync.tone === "active";

  return (
    <main className="min-h-screen bg-[var(--bg-app)]">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-[var(--border-toolbar)] bg-[var(--bg-toolbar)]">
        <span className="text-sm font-medium text-[var(--fg-toolbar)] truncate" title={documentName}>
          {documentName}
        </span>
        <div className="flex items-center gap-2">
          <span
            title={activeSync.tone === "failed" ? "Last save failed — it retries on the next edit, or press Save." : activeSync.label}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-[var(--border-toolbar)] text-[var(--fg-toolbar)]"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: SYNC_DOT[activeSync.tone] }}
            />
            {activeSync.label}
          </span>
          <button
            onClick={() => setSaveCounter((c) => c + 1)}
            disabled={saveBusy}
            title="Save now"
            className="px-2.5 py-1 text-sm rounded-lg border border-[var(--border-toolbar)] text-[var(--fg-toolbar)] hover:bg-[var(--bg-toolbar-hover)] disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => setShowEditors((v) => !v)}
            className="px-2.5 py-1 text-sm rounded-lg border border-[var(--border-toolbar)] text-[var(--fg-toolbar)] hover:bg-[var(--bg-toolbar-hover)]"
          >
            {showEditors ? "Hide editors" : "Editors"}
          </button>
          <InboxBell />
          <AuthButton compact />
        </div>
      </div>
      {showEditors && (
        <div className="px-3 py-2 max-w-xl space-y-3">
          <EditorsPanel projectId={documentName} projectTitle={documentName} />
          <ShareLinks projectId={documentName} projectTitle={documentName} />
        </div>
      )}
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
              // document/tab sync with each other. The hook encodes this to a
              // single URL path segment for `/collab/rooms/:id`.
              room: `${documentName}/${tab.name}`,
              userName: collaborator.name,
              userColor: collaborator.color,
              // Compressed Yjs snapshot from D1, applied before connecting.
              seedUpdate: seeds[tab.name] ?? null,
            }}
            d1Sync={{ projectId: documentName, tabName: tab.name, title: documentName }}
            onSyncChange={(s) => handleSync(tab.name, s)}
            saveRequestId={saveCounter}
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
