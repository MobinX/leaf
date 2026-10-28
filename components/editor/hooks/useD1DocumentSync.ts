import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { encodeDocForD1 } from "@/lib/yjsDocStore";
import { getDevEmail, saveDocTab } from "@/lib/teamApi";
import type { Collaboration } from "./useCollaboration";

export interface D1SyncTarget {
  projectId: string;
  tabName: string;
  title: string;
}

export type DocSaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface DocSyncState {
  status: DocSaveStatus;
  /** ISO timestamp of the last successful save, or null when never saved. */
  lastSavedAt: string | null;
}

const SAVE_DEBOUNCE_MS = 1_000;

/**
 * Persists the live Yjs doc to D1 as a compressed snapshot + JSON envelope.
 *
 * - Auto-saves ~1s after edits stop, and once shortly after opening.
 * - Best-effort flush when the tab hides or unloads.
 * - No-ops while signed out (and no dev email is set), so anonymous local
 *   editing keeps working offline-first.
 * - Returns the live sync state plus `saveNow` for an explicit Save button.
 */
export function useD1DocumentSync(
  collab: Collaboration | null,
  target: D1SyncTarget | null,
): { syncState: DocSyncState; saveNow: () => void } {
  const { user } = useAuth();
  const userRef = useRef(user);
  const collabRef = useRef(collab);
  const targetRef = useRef(target);
  // Kept current every render (in an effect, never during render) so the
  // stable `save` callback below always sees the latest values.
  useEffect(() => {
    userRef.current = user;
    collabRef.current = collab;
    targetRef.current = target;
  });

  const [syncState, setSyncState] = useState<DocSyncState>({
    status: "idle",
    lastSavedAt: null,
  });
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const disposedRef = useRef(false);

  const canSave = () => userRef.current !== null || getDevEmail() !== "";

  const save = useCallback(async () => {
    const c = collabRef.current;
    const t = targetRef.current;
    if (disposedRef.current || !c || !t) return;
    if (!canSave()) {
      // Not an error: anonymous readers simply have nowhere to save to yet.
      setSyncState((s) => (s.status === "pending" ? { ...s, status: "idle" } : s));
      return;
    }
    setSyncState((s) => ({ ...s, status: "saving" }));
    try {
      const stateB64 = await encodeDocForD1(c.ydoc);
      if (disposedRef.current) return;
      await saveDocTab(userRef.current, t.projectId, t.tabName, t.title, stateB64, {
        title: t.title,
        tab: t.tabName,
        savedAt: new Date().toISOString(),
        savedBy: userRef.current?.email ?? getDevEmail(),
        format: "yjs-gzip-b64-v1",
      });
      if (disposedRef.current) return;
      dirtyRef.current = false;
      setSyncState({ status: "saved", lastSavedAt: new Date().toISOString() });
    } catch {
      if (!disposedRef.current) setSyncState((s) => ({ ...s, status: "error" }));
    }
  }, []);

  const schedule = useCallback(() => {
    setSyncState((s) => (s.status === "saving" ? s : { ...s, status: "pending" }));
    if (timerRef.current !== undefined) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined;
      if (dirtyRef.current && !disposedRef.current) void save();
    }, SAVE_DEBOUNCE_MS);
  }, [save]);

  const saveNow = useCallback(() => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    void save();
  }, [save]);

  const targetProjectId = target?.projectId;
  const targetTabName = target?.tabName;

  useEffect(() => {
    if (!collab || !targetProjectId || !targetTabName) return;
    const { ydoc } = collab;
    disposedRef.current = false;
    // Opening a document auto-saves it: mark dirty so the normal debounced
    // path persists the freshly seeded state ~1s after open.
    const kickoff = setTimeout(() => {
      if (disposedRef.current) return;
      dirtyRef.current = true;
      schedule();
    }, 0);

    const onUpdate = () => {
      dirtyRef.current = true;
      schedule();
    };
    const flush = () => {
      if (dirtyRef.current && !disposedRef.current) {
        if (timerRef.current !== undefined) {
          clearTimeout(timerRef.current);
          timerRef.current = undefined;
        }
        void save();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };

    ydoc.on("update", onUpdate);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      disposedRef.current = true;
      clearTimeout(kickoff);
      if (timerRef.current !== undefined) clearTimeout(timerRef.current);
      ydoc.off("update", onUpdate);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [collab, targetProjectId, targetTabName, schedule, save]);

  return { syncState, saveNow };
}
