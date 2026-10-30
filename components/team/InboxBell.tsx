'use client';

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { acceptInvite, fetchInbox, rejectInvite, type Invite } from "@/lib/teamApi";

export default function InboxBell({ onAccepted }: { onAccepted?: (projectId: string) => void }) {
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchInbox(user);
      setInvites(data.invites);
    } catch (err) {
      if (user || typeof window !== "undefined") {
        setError(err instanceof Error ? err.message : "Could not load invites.");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  useEffect(() => {
    // Deferred so no state is set synchronously inside the effect body.
    const t = setTimeout(() => {
      void refresh();
    }, 0);
    const i = setInterval(refresh, 30000);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, [refresh]);

  const act = async (id: string, kind: "accept" | "reject") => {
    setBusy(id);
    setError(null);
    try {
      if (kind === "accept") {
        const res = await acceptInvite(user, id);
        setInvites((list) => list.filter((i) => i.id !== id));
        onAccepted?.(res.projectId);
      } else {
        await rejectInvite(user, id);
        setInvites((list) => list.filter((i) => i.id !== id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          refresh();
        }}
        title="Project invitations"
        aria-label="Project invitations"
        className="relative rounded-lg border border-[var(--border-toolbar)] p-2 text-[var(--fg-toolbar)] hover:bg-[var(--bg-toolbar-hover)]"
      >
        <Bell size={16} />
        {invites.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-semibold flex items-center justify-center">
            {invites.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-[var(--border-toolbar)] bg-[var(--bg-toolbar)] shadow-lg z-50">
          <div className="px-3 py-2 border-b border-[var(--border-toolbar)] flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--fg-toolbar)]">Document invitations</span>
            <button onClick={refresh} className="text-xs text-[var(--fg-toolbar)] underline">
              Refresh
            </button>
          </div>
          <div className="max-h-80 overflow-auto">
            {error && <p className="px-3 py-2 text-xs text-red-600">{error}</p>}
            {invites.length === 0 && !error && (
              <p className="px-3 py-4 text-sm text-[var(--fg-toolbar)] opacity-70">
                No pending invitations.
              </p>
            )}
            {invites.map((invite) => (
              <div key={invite.id} className="px-3 py-2.5 border-b border-[var(--border-toolbar)] last:border-0">
                <p className="text-sm text-[var(--fg-toolbar)]">
                  <span className="font-medium">{invite.inviter_email}</span> invited you to{" "}
                  <span className="font-medium">{invite.project_title}</span>
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    disabled={busy === invite.id}
                    onClick={() => act(invite.id, "accept")}
                    className="px-3 py-1 text-sm font-medium rounded-lg bg-[var(--bg-toolbar-active)] text-[var(--fg-toolbar-active)] hover:opacity-90 disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    disabled={busy === invite.id}
                    onClick={() => act(invite.id, "reject")}
                    className="px-3 py-1 text-sm rounded-lg border border-[var(--border-toolbar)] text-[var(--fg-toolbar)] hover:bg-[var(--bg-toolbar-hover)] disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
