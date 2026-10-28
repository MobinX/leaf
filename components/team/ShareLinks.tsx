'use client';

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  createShareLink,
  listShareLinks,
  revokeShareLink,
  type ShareLink,
} from "@/lib/teamApi";

interface Props {
  projectId: string;
  projectTitle: string;
}

/**
 * Share-link manager: create any number of links per document, each with its
 * own permission (reader = read-only, editor = can edit). Anyone holding a
 * link opens `/s/<token>` — no account needed. Listed links can be copied or
 * revoked. Only document editors can manage links.
 */
export default function ShareLinks({ projectId, projectTitle }: Props) {
  const { user } = useAuth();
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [label, setLabel] = useState("");
  const [permission, setPermission] = useState<"reader" | "editor">("reader");
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await listShareLinks(user, projectId);
      setLinks(data.links);
      setStatus(null);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not load share links.");
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

  const shareUrl = (token: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/s/${token}` : `/s/${token}`;

  const create = async () => {
    setCreating(true);
    setStatus(null);
    try {
      await createShareLink(user, projectId, permission, label.trim());
      setLabel("");
      setStatus(
        permission === "editor"
          ? "Editor link created — anyone with it can edit."
          : "Reader link created — anyone with it can read.",
      );
      await refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not create the link.");
    } finally {
      setCreating(false);
    }
  };

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      setCopied(token);
      setTimeout(() => setCopied((c) => (c === token ? null : c)), 2000);
    } catch {
      setStatus("Copy failed — select the link manually.");
    }
  };

  const revoke = async (token: string) => {
    if (!confirm("Revoke this link? Anyone holding it loses access.")) return;
    try {
      await revokeShareLink(user, token);
      await refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not revoke the link.");
    }
  };

  return (
    <section className="rounded-lg border border-[var(--border-toolbar)] bg-[var(--bg-toolbar)] p-4">
      <div className="flex items-center gap-2">
        <Link2 size={15} className="text-[var(--fg-toolbar)]" />
        <h2 className="text-sm font-semibold text-[var(--fg-toolbar)]">Share links</h2>
      </div>
      <p className="mt-1 text-xs text-[var(--fg-toolbar)] opacity-70">
        {projectTitle} — create as many links as needed, each reader or editor.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional, e.g. “Reviewers”)"
          maxLength={80}
          className="px-2.5 py-1.5 text-sm rounded-lg border border-[var(--border-input)] bg-[var(--bg-input)] text-[var(--fg-input)]"
        />
        <div className="flex items-center gap-2">
          <div
            role="radiogroup"
            aria-label="Link permission"
            className="flex rounded-lg border border-[var(--border-input)] overflow-hidden"
          >
            {(["reader", "editor"] as const).map((p) => (
              <button
                key={p}
                role="radio"
                aria-checked={permission === p}
                onClick={() => setPermission(p)}
                className={`px-3 py-1.5 text-sm capitalize ${
                  permission === p
                    ? "bg-[var(--bg-toolbar-active)] text-[var(--fg-toolbar-active)]"
                    : "text-[var(--fg-toolbar)] hover:bg-[var(--bg-toolbar-hover)]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={create}
            disabled={creating}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--bg-toolbar-active)] text-[var(--fg-toolbar-active)] hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create link"}
          </button>
        </div>
      </div>
      {status && <p className="mt-2 text-xs text-[var(--fg-toolbar)]">{status}</p>}

      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li
            key={link.token}
            className="px-2.5 py-2 rounded-lg bg-[var(--bg-toolbar-hover)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-[var(--fg-toolbar)] truncate">
                {link.label || "Untitled link"}
              </span>
              <span className="text-xs text-[var(--fg-toolbar)] opacity-70 shrink-0 capitalize">
                {link.permission}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <code className="flex-1 min-w-0 truncate text-xs text-[var(--fg-toolbar)] opacity-80">
                {shareUrl(link.token)}
              </code>
              <button
                onClick={() => copy(link.token)}
                title="Copy link"
                className="p-1.5 rounded-lg border border-[var(--border-toolbar)] text-[var(--fg-toolbar)] hover:bg-[var(--bg-toolbar)]"
              >
                {copied === link.token ? <Check size={14} /> : <Copy size={14} />}
              </button>
              <button
                onClick={() => revoke(link.token)}
                title="Revoke link"
                className="p-1.5 rounded-lg border border-[var(--border-toolbar)] text-[var(--fg-toolbar)] hover:bg-[var(--bg-toolbar)]"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
        {links.length === 0 && (
          <li className="text-sm text-[var(--fg-toolbar)] opacity-70">
            No share links yet.
          </li>
        )}
      </ul>
    </section>
  );
}
