'use client';

import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { ensureProject, fetchMembers, sendInvite } from "@/lib/teamApi";

interface Props {
  projectId: string;
  projectTitle: string;
}

/**
 * Document-scoped editors segment: invite by email, list editors, show
 * pending invites. One document is one project: an accepted invitee becomes an
 * editor of that document only. Editors share the Yjs room for the document,
 * so presence (who else is writing) keeps working through the caret extension.
 */
export default function EditorsPanel({ projectId, projectTitle }: Props) {
  const { user } = useAuth();
  const [members, setMembers] = useState<{ email: string; role: string }[]>([]);
  const [pending, setPending] = useState<{ id: string; invitee_email: string }[]>([]);
  const [myRole, setMyRole] = useState<string>("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    try {
      await ensureProject(user, projectId, projectTitle);
      const data = await fetchMembers(user, projectId);
      setMembers(data.members);
      setPending(data.pending);
      setMyRole(data.myRole);
      setStatus(null);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not load the editors.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, user?.email]);

  useEffect(() => {
    // Deferred so no state is set synchronously inside the effect body.
    const t = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  const invite = async () => {
    if (!email.trim()) return;
    setSending(true);
    setStatus(null);
    try {
      await sendInvite(user, projectId, projectTitle, email.trim());
      setEmail("");
      setStatus("Invite sent.");
      await refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not send the invite.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-lg border border-[var(--border-toolbar)] bg-[var(--bg-toolbar)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--fg-toolbar)]">Document editors</h2>
        {myRole && (
          <span className="text-xs text-[var(--fg-toolbar)] opacity-70">Your access: {myRole}</span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") invite();
          }}
          placeholder="teammate@example.com"
          type="email"
          className="flex-1 px-2.5 py-1.5 text-sm rounded-lg border border-[var(--border-input)] bg-[var(--bg-input)] text-[var(--fg-input)]"
        />
        <button
          onClick={invite}
          disabled={sending || !email.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--bg-toolbar-active)] text-[var(--fg-toolbar-active)] hover:opacity-90 disabled:opacity-50"
        >
          <Send size={14} />
          Invite
        </button>
      </div>
      {status && <p className="mt-2 text-xs text-[var(--fg-toolbar)]">{status}</p>}

      <ul className="mt-3 space-y-1.5">
        {members.map((m) => (
          <li
            key={m.email}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[var(--bg-toolbar-hover)]"
          >
            <span className="text-sm text-[var(--fg-toolbar)] truncate" title={m.email}>
              {m.email}
            </span>
            <span className="text-xs text-[var(--fg-toolbar)] opacity-70 ml-2 shrink-0">
              {m.role}
            </span>
          </li>
        ))}
        {members.length === 0 && (
          <li className="text-sm text-[var(--fg-toolbar)] opacity-70">
            Sign in, then the editors for this document will appear here.
          </li>
        )}
      </ul>

      {pending.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-[var(--fg-toolbar)]">Pending invites</p>
          <ul className="mt-1.5 space-y-1">
            {pending.map((p) => (
              <li key={p.id} className="text-sm text-[var(--fg-toolbar)] opacity-80">
                {p.invitee_email}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
