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
      <span className="text-sm text-[var(--fg-toolbar)] opacity-70">Checking session…</span>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={signInWithGoogle}
          className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-toolbar-active)] text-[var(--fg-toolbar-active)] text-sm font-medium rounded-lg hover:opacity-90"
        >
          <LogIn size={15} />
          Sign in with Google
        </button>
        {!configured && !compact && (
          <input
            value={devEmail}
            onChange={(e) => {
              setLocalDevEmail(e.target.value);
              setDevEmail(e.target.value);
            }}
            placeholder="dev email (no Firebase config)"
            className="px-2 py-1.5 text-sm rounded-lg border border-[var(--border-input)] bg-[var(--bg-input)] text-[var(--fg-input)] w-52"
          />
        )}
        {authError && <span className="text-xs text-red-600 max-w-56">{authError}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {user.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.photoUrl} alt="" className="w-7 h-7 rounded-full" />
      ) : (
        <span className="w-7 h-7 rounded-full bg-[var(--bg-toolbar-active)] text-[var(--fg-toolbar-active)] text-xs font-semibold flex items-center justify-center">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      {!compact && (
        <span className="text-sm text-[var(--fg-toolbar)] max-w-44 truncate" title={user.email}>
          {user.name}
        </span>
      )}
      <button
        onClick={signOutUser}
        title="Sign out"
        className="p-1.5 rounded-lg border border-[var(--border-toolbar)] text-[var(--fg-toolbar)] hover:bg-[var(--bg-toolbar-hover)]"
      >
        <LogOut size={15} />
      </button>
    </div>
  );
}
