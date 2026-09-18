"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinEventByCode } from "@/lib/actions/join";

export function JoinForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    setError("");
    startTransition(async () => {
      const res = await joinEventByCode(c);
      if (res.ok) {
        router.push(`/events/${res.eventId}`);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="参加コード（例：MK7QP2）"
        autoCapitalize="characters"
        autoComplete="off"
        className="w-full rounded-lg border bg-[var(--card)] px-3 py-3 text-center text-lg tracking-widest outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 font-medium text-[var(--accent-foreground)] disabled:opacity-60"
      >
        {pending ? "参加中…" : "このコードで参加する"}
      </button>
    </form>
  );
}
