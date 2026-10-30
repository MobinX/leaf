'use client';

import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getDevEmail, setDevEmail } from "@/lib/teamApi";

export default function AuthButton({ compact = false }: { compact?: boolean }) {
  const { user, loading, configured, signInWithGoogle, signOutUser, authError } = useAuth();
  const [devEmail, setLocalDevEmail] = useState(getDevEmail);

  if (loading) {
    return (
      <span
        className="flex items-center gap-2 text-sm text-[var(--fg-toolbar)] opacity-70"
        title="Checking session…"
      >
        <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <span className="hidden sm:inline">Checking session…</span>
      </span>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={signInWithGoogle}
          aria-label="Sign in with Google"
          title="Sign in with Google"
          className="flex items-center gap-2 rounded-lg bg-[var(--bg-toolbar-active)] px-2.5 py-1.5 text-sm font-medium text-[var(--fg-toolbar-active)] hover:opacity-90 sm:px-3"
        >
          <LogIn size={15} className="shrink-0" />
          <span className="hidden sm:inline">Sign in with Google</span>
        </button>
        {!configured && !compact && (
          <input
            value={devEmail}
            onChange={(e) => {
              setLocalDevEmail(e.target.value);
              setDevEmail(e.target.value);
            }}
            placeholder="dev email (no Firebase config)"
            aria-label="Dev email (no Firebase config)"
            className="hidden w-52 rounded-lg border border-[var(--border-input)] bg-[var(--bg-input)] px-2 py-1.5 text-sm text-[var(--fg-input)] md:block"
          />
        )}
        {authError && <span className="hidden max-w-56 text-xs text-red-600 md:inline">{authError}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {user.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.photoUrl} alt="" className="w-7 h-7 rounded-full" />
      ) : (
        <span className="w-7 h-7 rounded-full bg-[var(--bg-toolbar-active)] text-[var(--fg-toolbar-active)] text-xs font-semibold flex items-center justify-center">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      {!compact && (
        <span className="hidden max-w-44 truncate text-sm text-[var(--fg-toolbar)] sm:inline" title={user.email}>
          {user.name}
        </span>
      )}
      <button
        onClick={signOutUser}
        title="Sign out"
        aria-label="Sign out"
        className="p-1.5 rounded-lg border border-[var(--border-toolbar)] text-[var(--fg-toolbar)] hover:bg-[var(--bg-toolbar-hover)]"
      >
        <LogOut size={15} />
      </button>
    </div>
  );
}
