'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Folder, Leaf } from 'lucide-react';
import { DocumentStorage } from '@/lib/documentStorage';
import { useAuth } from '@/lib/AuthContext';
import type { ServerDocument } from '@/lib/documentTypes';
import AuthButton from '@/components/team/AuthButton';
import InboxBell from '@/components/team/InboxBell';

export interface DocumentCard {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** Number of saved tabs, when the server knows them. */
  tabs: number;
  /** True when the document exists on the server (D1). */
  remote: boolean;
}

function toCard(doc: ServerDocument): DocumentCard {
  return {
    id: doc.id,
    title: doc.title || doc.id,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    tabs: doc.tabs?.length ?? 0,
    remote: true,
  };
}

export default function HomeView({
  initialDocuments,
  serverAuthenticated,
}: {
  initialDocuments: ServerDocument[];
  /** True when the server identified the visitor (list is authoritative). */
  serverAuthenticated?: boolean;
}) {
  const router = useRouter();
  const { user, configured, signInWithGoogle } = useAuth();
  // The server already rendered the signed-in user's documents, so the list
  // is on screen with the first byte — no client-side fetch, no spinner.
  const [documents, setDocuments] = useState<DocumentCard[]>(() =>
    initialDocuments.map(toCard),
  );
  // Only wait for the local list when the server could not identify the
  // visitor (signed out) — otherwise the server list is already the answer.
  const [isLoading, setIsLoading] = useState(
    !serverAuthenticated && initialDocuments.length === 0,
  );
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Close the sign-in prompt once the user is in.
  useEffect(() => {
    if (!user) return;
    // Deferred so no state is set synchronously inside the effect body.
    const t = setTimeout(() => setShowSignInPrompt(false), 0);
    return () => clearTimeout(t);
  }, [user]);

  // Merge the local (offline-first) copies with the server list: the server
  // wins for shared documents, local-only drafts are kept.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const storage = await DocumentStorage.getInstance();
        const local = await storage.listDocuments();
        if (cancelled) return;
        setDocuments((current) => {
          const byId = new Map(current.map((d) => [d.id, d]));
          for (const meta of local) {
            const existing = byId.get(meta.id);
            if (!existing) {
              byId.set(meta.id, {
                id: meta.id,
                title: meta.id,
                createdAt: meta.createdAt,
                updatedAt: meta.updatedAt,
                tabs: 0,
                remote: false,
              });
            } else if (new Date(meta.updatedAt) > new Date(existing.updatedAt)) {
              existing.updatedAt = meta.updatedAt;
            }
          }
          return [...byId.values()].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          );
        });
      } catch (error) {
        console.error('Failed to load documents:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(
    () =>
      [...documents].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [documents],
  );

  const handleCreateDocument = async () => {
    // Documents require an account (except in unconfigured dev mode).
    if (configured && !user) {
      setShowNewDialog(false);
      setShowSignInPrompt(true);
      return;
    }
    if (!newDocName.trim()) return;

    setIsCreating(true);
    try {
      const sanitizedName = newDocName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      router.push(`/editor/${encodeURIComponent(sanitizedName)}`);
    } catch (error) {
      console.error('Failed to create document:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteDocument = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Delete document "${id}"? This cannot be undone.`)) {
      return;
    }

    // Remove it locally right away, then tell the server (best effort).
    setDocuments((docs) => docs.filter((d) => d.id !== id));
    try {
      const storage = await DocumentStorage.getInstance();
      await storage.deleteDocument(id);
    } catch (error) {
      console.error('Failed to delete local document:', error);
    }
    try {
      await fetch(`/api/projects/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: user
          ? { authorization: `Bearer ${await user.getIdToken()}` }
          : undefined,
      });
    } catch (error) {
      console.error('Failed to delete remote document:', error);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header / nav bar — single row on mobile so the actions never wrap
          behind the title. The brand block truncates, the actions never shrink. */}
      <header className="sticky top-0 z-40 border-b border-blue-200 bg-white/85 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-3 sm:px-6">
          <div className="flex h-14 items-center gap-2 sm:h-auto sm:gap-3 sm:py-6">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
                <Leaf size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-gray-900 sm:text-3xl">Leaf Documents</h1>
                <p className="hidden truncate text-sm text-gray-600 sm:block">
                  Create and manage your AI-powered documents
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <AuthButton />
              <InboxBell />
              <button
                onClick={() => setShowNewDialog(true)}
                aria-label="New document"
                title="New document"
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-blue-700 sm:px-4 sm:text-base"
              >
                <Plus size={20} />
                <span className="hidden min-[420px]:inline">New Document</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-4">Loading your documents...</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20">
            <Folder size={48} className="mx-auto text-gray-400 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">No documents yet</h2>
            <p className="text-gray-600 mb-8">Create your first document to get started</p>
            <button
              onClick={() => setShowNewDialog(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              Create Your First Document
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {sorted.map((doc) => (
              <Link key={doc.id} href={`/editor/${encodeURIComponent(doc.id)}`}>
                <div className="bg-white rounded-lg shadow hover:shadow-lg transition-all cursor-pointer border border-gray-200 hover:border-blue-300 p-6 group">
                  <div className="flex items-start justify-between mb-3">
                    <Folder size={32} className="text-blue-500" />
                    <button
                      onClick={(e) => handleDeleteDocument(doc.id, e)}
                      aria-label={`Delete ${doc.id}`}
                      className="p-1.5 text-gray-400 transition-all hover:text-red-500 focus-visible:opacity-100 focus-visible:text-red-500 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                      title="Delete document"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <h3 className="font-semibold text-lg text-gray-900 mb-2 truncate">{doc.title || doc.id}</h3>
                  <p className="text-sm text-gray-500">Updated {formatDate(doc.updatedAt)}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {doc.tabs > 0 ? `${doc.tabs} tab${doc.tabs === 1 ? '' : 's'} · ` : ''}
                    Created {formatDate(doc.createdAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* New Document Dialog */}
      {showNewDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Document</h2>
            <input
              type="text"
              placeholder="Enter document name..."
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateDocument();
                if (e.key === 'Escape') setShowNewDialog(false);
              }}
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNewDialog(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDocument}
                disabled={!newDocName.trim() || isCreating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign-in required dialog */}
      {showSignInPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in required</h2>
            <p className="text-gray-600 mb-6">Please sign in with Google to create documents.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSignInPrompt(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => signInWithGoogle()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sign in with Google
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
