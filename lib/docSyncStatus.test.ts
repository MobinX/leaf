import { describe, expect, test } from "bun:test";
import { formatSyncStatus } from "./docSyncStatus";

describe("formatSyncStatus", () => {
  test("idle and in-flight states", () => {
    expect(formatSyncStatus({ status: "idle", lastSavedAt: null })).toEqual({
      label: "Not saved yet",
      tone: "neutral",
    });
    expect(formatSyncStatus({ status: "pending", lastSavedAt: null }).label).toBe("Saving…");
    expect(formatSyncStatus({ status: "pending", lastSavedAt: null }).tone).toBe("active");
    expect(formatSyncStatus({ status: "saving", lastSavedAt: null }).label).toBe("Saving…");
  });

  test("saved shows the last-saved time", () => {
    const lastSavedAt = new Date("2026-10-28T12:34:56.000Z").toISOString();
    const shown = formatSyncStatus({ status: "saved", lastSavedAt });
    expect(shown.tone).toBe("done");
    expect(shown.label.startsWith("Saved · ")).toBe(true);
    expect(shown.label.length).toBeGreaterThan("Saved · ".length);
  });

  test("saved without a timestamp still reads Saved", () => {
    expect(formatSyncStatus({ status: "saved", lastSavedAt: null })).toEqual({
      label: "Saved",
      tone: "done",
    });
  });

  test("error reads Save failed", () => {
    expect(formatSyncStatus({ status: "error", lastSavedAt: null })).toEqual({
      label: "Save failed",
      tone: "failed",
    });
  });
});
