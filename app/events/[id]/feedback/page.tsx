import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { MyFeedback } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_feedback", {
    target_event_id: id,
  });

  const fb = (data as MyFeedback | null) ?? null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/events/${id}`} className="text-sm text-[var(--muted-foreground)]">
          ← {event.title}
        </Link>
        <Link
          href="/events"
          className="rounded-md border px-3 py-1.5 text-xs text-[var(--foreground)]"
        >
          ホーム
        </Link>
      </div>

      <h1 className="text-xl font-bold">自分が受けたフィードバック</h1>

      {error && (
        <p className="mt-4 text-sm text-[var(--danger)]">
          読み込みに失敗しました：{error.message}
        </p>
      )}

      {!error && (!fb || fb.evaluation_count === 0) ? (
        <div className="mt-6 rounded-xl border bg-[var(--card)] p-5 text-sm text-[var(--muted-foreground)]">
          まだ評価が届いていません。面接が終わり、メンバーが評価を送信すると集計が表示されます。
        </div>
      ) : fb ? (
        <div className="mt-4 space-y-8">
          <p className="text-sm text-[var(--muted-foreground)]">
            {fb.evaluation_count} 名からの評価をまとめています。
            <br />
            <span className="text-xs">
              （誰がどの評価をしたかは分かりません。匿名で集計しています）
            </span>
          </p>

          {/* rubric */}
          <section>
            <h2 className="mb-3 font-semibold">項目別スコア</h2>
            <div className="space-y-4">
              {fb.rubric.map((r) => {
                const avg = r.avg ?? 0;
                const pct = Math.max(0, Math.min(100, (avg / 5) * 100));
                return (
                  <div key={r.rubric_item_id}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium">{r.label}</span>
                      <span className="text-sm">
                        <b className="text-base">{r.avg ?? "-"}</b>
                        <span className="text-xs text-[var(--muted-foreground)]"> / 5</span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      最小 {r.min ?? "-"}・最大 {r.max ?? "-"}（{r.count}件）
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 最優先の改善点 */}
          {fb.top_improvement.length > 0 && (
            <section>
              <h2 className="mb-2 font-semibold text-[var(--improve)]">
                次に直すべき点（最も多く選ばれた順）
              </h2>
              <ul className="space-y-1.5">
                {fb.top_improvement.map((t, i) => (
                  <li
                    key={t.comment_option_id}
                    className={`flex items-center justify-between rounded-lg border p-3 text-sm ${
                      i === 0 ? "border-[var(--improve)] bg-[var(--improve)]/10" : "bg-[var(--card)]"
                    }`}
                  >
                    <span>{t.text}</span>
                    <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                      {t.count}人が選択
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* good */}
          {fb.comments.good.length > 0 && (
            <TallyList
              title="良かった点"
              tone="good"
              items={fb.comments.good}
            />
          )}

          {/* improve */}
          {fb.comments.improve.length > 0 && (
            <TallyList
              title="改善点"
              tone="improve"
              items={fb.comments.improve}
            />
          )}

          {/* free notes */}
          <section>
            <h2 className="mb-2 font-semibold">ひとことメモ</h2>
            {fb.free_notes.length > 0 ? (
              <ul className="space-y-2">
                {fb.free_notes.map((note, i) => (
                  <li
                    key={i}
                    className="rounded-lg border bg-[var(--card)] p-3 text-sm leading-relaxed"
                  >
                    {note}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--muted-foreground)]">
                メモは2件以上集まったときに表示されます（書いた人が特定されないようにするため）。
              </p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function TallyList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "good" | "improve";
  items: { comment_option_id: string; text: string; count: number }[];
}) {
  const color = tone === "good" ? "var(--good)" : "var(--improve)";
  return (
    <section>
      <h2 className="mb-2 font-semibold" style={{ color }}>
        {title}
      </h2>
      <ul className="space-y-1.5">
        {items.map((c) => (
          <li
            key={c.comment_option_id}
            className="flex items-center justify-between rounded-lg border bg-[var(--card)] p-3 text-sm"
          >
            <span>{c.text}</span>
            <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
              {c.count}人が選択
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
