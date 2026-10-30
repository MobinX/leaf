'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, Save, Users } from 'lucide-react';
import { useDocumentState } from '@/app/editor/hooks/useDocumentState';
import { useAuth } from '@/lib/AuthContext';
import { decodeDocFromD1 } from '@/lib/yjsDocStore';
import { ensureProject, loadDocTab } from '@/lib/teamApi';
import { formatSyncStatus } from '@/lib/docSyncStatus';
import type { DocSyncState } from '@/components/editor/hooks/useD1DocumentSync';
import type { ServerDocTab } from '@/lib/documentTypes';
import AuthButton from '@/components/team/AuthButton';
import InboxBell from '@/components/team/InboxBell';
import TabBar from '@/components/editor/TabBar';
import EditorsPanel from '@/components/team/EditorsPanel';
import ShareLinks from '@/components/team/ShareLinks';

const TiptapEditor = dynamic(() => import('@/components/editor/TiptapEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[100dvh] bg-gray-100">
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

export default function EditorWorkspace({
  documentName,
  initialTabs,
}: {
  documentName: string;
  /** Tabs (with their compressed Yjs state) rendered on the server. */
  initialTabs: ServerDocTab[];
}) {
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
  // Yjs snapshots per tab, applied to each fresh Y.Doc before it connects.
  const [seeds, setSeeds] = useState<Record<string, Uint8Array | null>>({});
  const [seedsReady, setSeedsReady] = useState(initialTabs.length === 0);
  const fetchedTabs = useRef<Set<string>>(new Set());

  // Server-rendered tabs are decoded right away — no network round trip and
  // no waiting for the Firebase SDK to boot.
  useEffect(() => {
    if (initialTabs.length === 0) return;
    let cancelled = false;
    void (async () => {
      const entries: Record<string, Uint8Array | null> = {};
      for (const tab of initialTabs) {
        try {
          entries[tab.name] = await decodeDocFromD1(tab.stateB64);
        } catch {
          entries[tab.name] = null;
        }
      }
      if (cancelled) return;
      setSeeds((prev) => ({ ...prev, ...entries }));
      setSeedsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialTabs]);

  // Fallback for tabs the server did not have (e.g. signed-out visitors, or
  // a tab created locally that has never been saved).
  useEffect(() => {
    if (!document || authLoading || seedsReady) return;
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
      if (cancelled) return;
      setSeeds((prev) => ({ ...prev, ...entries }));
      setSeedsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [document, documentName, user, authLoading, seedsReady]);

  // Register the document on the server so it shows up in the home list.
  // Without this, saving to D1 fails (the project row must exist first).
  useEffect(() => {
    // Wait for the session to resolve so the request carries the right
    // identity (Firebase token, or the local dev email).
    if (authLoading) return;
    void (async () => {
      try {
        await ensureProject(user, documentName, documentName);
      } catch (error) {
        console.warn('Could not register the document:', error);
      }
    })();
  }, [user, documentName, authLoading]);

  // Merge the server's tab list into the local document, so tabs saved on
  // another device show up here too.
  useEffect(() => {
    if (!document || initialTabs.length === 0) return;
    const known = new Set(document.tabs.map((t) => t.name));
    const missing = initialTabs.filter((t) => !known.has(t.name));
    if (missing.length === 0) return;
    const added = missing.map((tab) => ({
      id: `tab-${tab.name}`,
      name: tab.name,
      content: '',
    }));
    updateDocument({
      tabs: [...document.tabs, ...added],
      activeTabId: document.tabs.some((t) => t.id === document.activeTabId)
        ? document.activeTabId
        : added[0].id,
    });
  }, [document, initialTabs, updateDocument]);

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

  const activeTabName =
    document?.tabs.find((t) => t.id === document.activeTabId)?.name ?? "";
  const activeSync = formatSyncStatus(
    syncMap[activeTabName] ?? { status: "idle", lastSavedAt: null },
  );
  const saveBusy = activeSync.tone === "active";

  // The nav bar is rendered on the server too, so the document title and the
  // back link are visible in the first paint instead of a blank screen.
  const header = (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--border-toolbar)] bg-[var(--bg-toolbar)] px-2 sm:px-3">
      <Link
        href="/"
        title="Back to documents"
        aria-label="Back to documents"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--border-toolbar)] text-[var(--fg-toolbar)] hover:bg-[var(--bg-toolbar-hover)]"
      >
        <ArrowLeft size={16} />
      </Link>

      <span
        className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--fg-toolbar)]"
        title={documentName}
      >
        {documentName}
      </span>

      <div className="flex shrink-0 items-center gap-1.5">
        <span
          title={activeSync.tone === "failed" ? "Last save failed — it retries on the next edit, or press Save." : activeSync.label}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border-toolbar)] px-2 py-1 text-xs text-[var(--fg-toolbar)]"
        >
          <span
            className="w-2 h-2 shrink-0 rounded-full"
            style={{ backgroundColor: SYNC_DOT[activeSync.tone] }}
          />
          <span className="hidden sm:inline">{activeSync.label}</span>
        </span>

        <button
          onClick={() => setSaveCounter((c) => c + 1)}
          disabled={saveBusy}
          title="Save now"
          aria-label="Save now"
          className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-toolbar)] text-[var(--fg-toolbar)] hover:bg-[var(--bg-toolbar-hover)] disabled:opacity-50 sm:h-auto sm:w-auto sm:px-2.5 sm:py-1 sm:text-sm"
        >
          <Save size={16} className="sm:hidden" />
          <span className="hidden sm:inline">Save</span>
        </button>

        <button
          onClick={() => setShowEditors((v) => !v)}
          title={showEditors ? "Hide editors" : "Editors"}
          aria-label={showEditors ? "Hide editors" : "Editors"}
          aria-expanded={showEditors}
          className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-toolbar)] text-[var(--fg-toolbar)] hover:bg-[var(--bg-toolbar-hover)] sm:h-auto sm:w-auto sm:px-2.5 sm:py-1 sm:text-sm"
        >
          <Users size={16} className="sm:hidden" />
          <span className="hidden sm:inline">{showEditors ? "Hide editors" : "Editors"}</span>
        </button>

        <InboxBell />
        <AuthButton compact />
      </div>
    </header>
  );

  // The document could not be loaded at all (as opposed to still loading).
  if (!document && !isLoading) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-[var(--bg-app)]">
        <div className="text-lg font-medium text-red-600">Failed to load document</div>
      </div>
    );
  }

  // While the local document state and the D1 snapshots are still settling,
  // render the shell (header included) with a quiet canvas placeholder.
  if (isLoading || !document || !seedsReady) {
    return (
      <main className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg-app)]">
        {header}
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          <div className="text-sm font-medium text-[var(--fg-toolbar)] animate-pulse">
            {seedsReady ? "Loading document…" : "Preparing shared document…"}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg-app)]">
      {/* Nav bar — one fixed-height row on every breakpoint. The title takes the
          slack (truncating) and the action cluster never shrinks or wraps, so
          nothing can slide under the toolbar or off the right edge. */}
      {header}

      {showEditors && (
        <div className="max-h-[45vh] shrink-0 space-y-3 overflow-y-auto px-3 py-2">
          <EditorsPanel projectId={documentName} projectTitle={documentName} />
          <ShareLinks projectId={documentName} projectTitle={documentName} />
        </div>
      )}

      <div className="min-h-0 flex-1">
        {document.tabs.map((tab) => (
          <div
            key={tab.id}
            className={tab.id === document.activeTabId ? 'flex h-full min-h-0' : 'hidden'}
          >
            <TiptapEditor
              initialContent={tab.content}
              onContentChange={(content) => handleContentChange(tab.id, content)}
              pageSettings={document.pageSettings}
              onPageSettingsChange={(settings) => updateDocument({ pageSettings: settings })}
              documentName={documentName}
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
      </div>

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
