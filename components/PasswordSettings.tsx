"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PasswordSettings() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("6文字以上にしてください");
      return;
    }
    setBusy(true);
    setError("");
    setDone(false);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setPassword("");
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="text-sm font-medium">新しいパスワード</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="6文字以上"
          className="mt-1 w-full rounded-lg border bg-[var(--card)] px-3 py-3 text-base outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </label>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {done && <p className="text-sm text-[var(--accent)]">パスワードを設定しました。次回からメール＋パスワードで入れます。</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 font-medium text-[var(--accent-foreground)] disabled:opacity-60"
      >
        {busy ? "保存中…" : "パスワードを設定する"}
      </button>
    </form>
  );
}
