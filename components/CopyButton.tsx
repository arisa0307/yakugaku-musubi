"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label = "コピー",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // クリップボードが使えない環境向けフォールバック
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* noop */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ??
        "rounded-lg border border-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent)]"
      }
    >
      {copied ? "✓ コピーしました" : label}
    </button>
  );
}
