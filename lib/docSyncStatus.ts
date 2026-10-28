import type { DocSyncState } from "@/components/editor/hooks/useD1DocumentSync";

export type SyncTone = "neutral" | "active" | "done" | "failed";

/**
 * User-facing save indicator text + tone for the document header.
 * Contract: while a save is pending or in flight it says Saving…; after a
 * save it says Saved with the last-saved time; failures say Save failed.
 */
export function formatSyncStatus(state: DocSyncState): { label: string; tone: SyncTone } {
  switch (state.status) {
    case "saving":
    case "pending":
      return { label: "Saving…", tone: "active" };
    case "saved": {
      const time = state.lastSavedAt ? formatTime(state.lastSavedAt) : null;
      return { label: time ? `Saved · ${time}` : "Saved", tone: "done" };
    }
    case "error":
      return { label: "Save failed", tone: "failed" };
    case "idle":
    default:
      return { label: "Not saved yet", tone: "neutral" };
  }
}

function formatTime(iso: string): string | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleTimeString();
}
