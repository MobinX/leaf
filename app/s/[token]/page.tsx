'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { decodeDocFromD1 } from "@/lib/yjsDocStore";
import {
  loadDocTab,
  resolveShareLink,
  setShareToken,
  type ResolvedShareLink,
} from "@/lib/teamApi";

const TiptapEditor = dynamic(() => import("@/components/editor/TiptapEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="text-lg font-medium text-gray-600 animate-pulse">Loading shared document...</div>
    </div>
  ),
});

const SERVER_URL = process.env.NEXT_PUBLIC_YJS_SERVER?.trim() || undefined;

const COLORS = ["#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4", "#42d4f4", "#f032e6", "#bfef45", "#fabed4", "#469990"];

function visitorIdentity(kind: string) {
  if (typeof window === "undefined") return { name: "Guest", color: COLORS[0] };
  try {
    const stored = window.localStorage.getItem("leaf-share-user");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.name && parsed?.color) return parsed;
    }
  } catch {
    // fall through
  }
  const identity = {
    name: `${kind}-${Math.floor(Math.random() * 10000)}`,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
  try {
    window.localStorage.setItem("leaf-share-user", JSON.stringify(identity));
  } catch {
    // ignore
  }
  return identity;
}

/**
 * Public share route: `/s/<token>`. No account needed — the token in the URL
 * is the credential (sent as `x-share-token`). Reader links render read-only
 * without toolbars; editor links edit and auto-save back to D1, joining the
 * same live Yjs room as the document owners.
 */
export default function SharedDocumentPage() {
  const params = useParams();
  const token = decodeURIComponent(params.token as string);
  const [link, setLink] = useState<ResolvedShareLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [seeds, setSeeds] = useState<Record<string, Uint8Array | null>>({});
  const [seedsReady, setSeedsReady] = useState(false);
  const fetched = useRef<Set<string>>(new Set());
  const identity = useMemo(
    () => visitorIdentity(link?.permission === "editor" ? "Editor" : "Reader"),
    [link?.permission],
  );

  useEffect(() => {
    setShareToken(token);
    return () => setShareToken(null);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const resolved = await resolveShareLink(token);
        if (!cancelled) {
          setLink(resolved);
          setActiveTab(resolved.tabs[0]?.name ?? null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "This link is invalid.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!link) return;
    const missing = link.tabs.map((t) => t.name).filter((n) => !fetched.current.has(n));
    let cancelled = false;
    void (async () => {
      const entries: Record<string, Uint8Array | null> = {};
      for (const name of missing) {
        fetched.current.add(name);
        try {
          const res = await loadDocTab(null, link.projectId, name);
          entries[name] =
            res && "stateB64" in res && res.stateB64 ? await decodeDocFromD1(res.stateB64) : null;
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
  }, [link]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-[var(--bg-app)] px-4">
        <div className="max-w-md text-center">
          <p className="text-lg font-medium text-[var(--fg-toolbar)]">This link doesn&apos;t work</p>
          <p className="mt-2 text-sm text-[var(--fg-toolbar)] opacity-70">{error}</p>
        </div>
      </div>
    );
  }

  if (!link || !seedsReady) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-[var(--bg-app)]">
        <div className="text-lg font-medium text-[var(--fg-toolbar)] animate-pulse">
          Loading shared document...
        </div>
      </div>
    );
  }

  const isReader = link.permission === "reader";

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg-app)]">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-1.5 border-b border-[var(--border-toolbar)] bg-[var(--bg-toolbar)]">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--fg-toolbar)]" title={link.title}>
          {link.title}
        </span>
        <span className="shrink-0 text-xs text-[var(--fg-toolbar)] opacity-70">
          <span className="hidden sm:inline">Shared link · </span>
          {isReader ? "read-only" : "can edit"}
        </span>
      </div>
      {link.tabs.length > 1 && (
        <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-[var(--border-toolbar)] bg-[var(--bg-toolbar)]">
          {link.tabs.map((t) => (
            <button
              key={t.name}
              onClick={() => setActiveTab(t.name)}
              className={`px-2.5 py-1 text-sm rounded-lg whitespace-nowrap ${
                activeTab === t.name
                  ? "bg-[var(--bg-toolbar-active)] text-[var(--fg-toolbar-active)]"
                  : "border border-[var(--border-toolbar)] text-[var(--fg-toolbar)] hover:bg-[var(--bg-toolbar-hover)]"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
      {link.tabs.length === 0 && (
        <p className="px-4 py-10 text-center text-sm text-[var(--fg-toolbar)] opacity-70">
          Nothing has been saved to this shared document yet.
        </p>
      )}
      <div className="min-h-0 flex-1">
        {link.tabs.map((t) => (
          <div key={t.name} className={activeTab === t.name ? "flex h-full min-h-0" : "hidden"}>
            <TiptapEditor
              collaboration={{
                serverUrl: SERVER_URL,
                room: `${link.projectId}/${t.name}`,
                userName: identity.name,
                userColor: identity.color,
                seedUpdate: seeds[t.name] ?? null,
              }}
              d1Sync={
                isReader
                  ? null
                  : { projectId: link.projectId, tabName: t.name, title: link.title }
              }
              readOnly={isReader}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
