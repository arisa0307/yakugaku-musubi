"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function RecoveryEmail({ currentEmail }: { currentEmail: string | null }) {
  const [email, setEmail] = useState(currentEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    if (!mail.includes("@")) {
      setError("メールアドレスを正しく入力してください。");
      return;
    }
    setBusy(true);
    setError("");
    setDone(false);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: mail });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {currentEmail && (
        <p className="text-xs text-[var(--muted-foreground)]">
          現在の登録メール：<b>{currentEmail}</b>
        </p>
      )}
      <label className="block">
        <span className="text-sm font-medium">リカバリー用メール</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1 w-full rounded-lg border bg-[var(--card)] px-3 py-3 text-base outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </label>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {done && (
        <p className="text-sm text-[var(--accent)]">
          確認メールを送りました。メール内のリンクを開くと登録完了です。以後はこのメールでのログイン・パスワード再設定が使えます。
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 font-medium text-[var(--accent-foreground)] disabled:opacity-60"
      >
        {busy ? "送信中…" : "このメールを登録する"}
      </button>
    </form>
  );
}
