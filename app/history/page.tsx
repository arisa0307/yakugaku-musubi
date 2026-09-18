import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import type { HistoryEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "日時未定";
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_history");
  const history = (data as HistoryEvent[] | null) ?? [];

  // label ごとに時系列で束ねる
  const labels: string[] = [];
  for (const ev of history) {
    for (const it of ev.items) if (!labels.includes(it.label)) labels.push(it.label);
  }
  labels.sort((a, b) => a.localeCompare(b, "ja"));

  return (
    <div>
      <AppHeader subtitle="スコア推移" />
      <h1 className="text-xl font-bold">項目別スコアの推移</h1>

      {error && (
        <p className="mt-4 text-sm text-[var(--danger)]">
          読み込みに失敗しました：{error.message}
        </p>
      )}

      {history.length === 0 ? (
        <div className="mt-6 rounded-xl border bg-[var(--card)] p-5 text-sm text-[var(--muted-foreground)]">
          まだ評価データがありません。
        </div>
      ) : (
        <>
          {history.length < 2 && (
            <div className="mt-4 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3 text-xs">
              いまは1回分のデータです。<b>2回目以降で推移が見られます</b>。
            </div>
          )}

          <div className="mt-6 space-y-6">
            {labels.map((label) => (
              <div key={label} className="rounded-xl border bg-[var(--card)] p-4">
                <h2 className="mb-2 text-sm font-semibold">{label}</h2>
                <div className="space-y-1.5">
                  {history.map((ev) => {
                    const it = ev.items.find((i) => i.label === label);
                    const avg = it?.avg ?? null;
                    const pct = avg ? Math.max(0, Math.min(100, (avg / 5) * 100)) : 0;
                    return (
                      <div key={ev.event_id} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 truncate text-xs text-[var(--muted-foreground)]">
                          {formatDate(ev.scheduled_at)}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--muted)]">
                          <div
                            className="h-full rounded-full bg-[var(--accent)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right text-xs font-medium">
                          {avg ?? "-"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
