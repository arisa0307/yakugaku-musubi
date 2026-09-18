"use client";

import { useState, useTransition } from "react";
import { setMyHarshness } from "@/lib/actions/participants";
import {
  HARSHNESS_DESCRIPTION,
  HARSHNESS_LABEL,
  HARSHNESS_VALUES,
  type Harshness,
} from "@/lib/harshness";

export function HarshnessSelector({
  eventId,
  initial,
}: {
  eventId: string;
  initial: Harshness;
}) {
  const [value, setValue] = useState<Harshness>(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function choose(next: Harshness) {
    if (next === value || pending) return;
    const prev = value;
    setValue(next);
    setSaved(false);
    startTransition(async () => {
      const res = await setMyHarshness(eventId, next);
      if (!res.ok) {
        setValue(prev); // 失敗したら戻す
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {HARSHNESS_VALUES.map((h) => {
          const active = value === h;
          return (
            <button
              key={h}
              type="button"
              onClick={() => choose(h)}
              aria-pressed={active}
              className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "bg-[var(--card)] text-[var(--foreground)]"
              }`}
            >
              {HARSHNESS_LABEL[h]}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        {HARSHNESS_DESCRIPTION[value]}
      </p>
      <p className="mt-1 h-4 text-xs text-[var(--accent)]">
        {pending ? "保存中…" : saved ? "保存しました" : ""}
      </p>
    </div>
  );
}
