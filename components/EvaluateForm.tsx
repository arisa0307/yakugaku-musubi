"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitEvaluation } from "@/lib/actions/evaluations";
import {
  HARSHNESS_LABEL,
  isImproveVisible,
  validateEvaluation,
  type Harshness,
} from "@/lib/harshness";
import type { CommentOption, RubricItem } from "@/lib/types";

type Props = {
  eventId: string;
  evaluateeId: string;
  evaluateeName: string;
  mode: Harshness;
  rubric: RubricItem[];
  commentOptions: CommentOption[];
  initialScores: Record<string, number>;
  initialChipIds: string[];
  initialTopImprovementId: string;
  initialFreeNote: string;
  alreadySubmitted: boolean;
};

export function EvaluateForm(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const goodOptions = useMemo(
    () => props.commentOptions.filter((o) => o.kind === "good"),
    [props.commentOptions]
  );
  const improveOptions = useMemo(
    () =>
      props.commentOptions.filter(
        (o) => o.kind === "improve" && isImproveVisible(o.min_harshness, props.mode)
      ),
    [props.commentOptions, props.mode]
  );
  // 初期チップを good / improve に振り分け
  const initialGood = new Set<string>();
  const initialImprove = new Set<string>();
  const kindById = new Map(props.commentOptions.map((o) => [o.id, o.kind]));
  for (const cid of props.initialChipIds) {
    if (kindById.get(cid) === "good") initialGood.add(cid);
    else if (kindById.get(cid) === "improve") initialImprove.add(cid);
  }

  const [scores, setScores] = useState<Record<string, number>>(props.initialScores);
  const [goodChips, setGoodChips] = useState<Set<string>>(initialGood);
  const [improveChips, setImproveChips] = useState<Set<string>>(initialImprove);
  const [topImprovementId, setTopImprovementId] = useState(
    props.initialTopImprovementId
  );
  const [freeNote, setFreeNote] = useState(props.initialFreeNote);

  const scoredCount = props.rubric.filter(
    (r) => typeof scores[r.id] === "number"
  ).length;

  const validation = validateEvaluation({
    mode: props.mode,
    scoredCount,
    totalRubric: props.rubric.length,
    improveChipCount: improveChips.size,
    hasTopImprovement: Boolean(topImprovementId),
  });

  function setScore(rubricId: string, score: number) {
    setScores((prev) => ({ ...prev, [rubricId]: score }));
  }

  function toggleGood(id: string) {
    setGoodChips((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleImprove(id: string) {
    setImproveChips((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      // 甘口は改善点チップを実質1つに（クリックで置き換え）
      if (props.mode === "amakuchi") return new Set([id]);
      next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    setShowErrors(true);
    setError("");
    if (!validation.ok) return;

    startTransition(async () => {
      const res = await submitEvaluation({
        eventId: props.eventId,
        evaluateeId: props.evaluateeId,
        scores,
        goodChipIds: Array.from(goodChips),
        improveChipIds: Array.from(improveChips),
        topImprovementId,
        freeNote,
      });
      if (res.ok) {
        router.push(`/events/${props.eventId}`);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="pb-28">
      <h1 className="text-xl font-bold">
        {props.evaluateeName} さんの評価
      </h1>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        希望フィードバック: <b>{HARSHNESS_LABEL[props.mode]}</b>
        {props.alreadySubmitted && "（送信済み・編集できます）"}
      </p>

      {/* 5点の定義 */}
      <div className="mt-3 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3 text-xs text-[var(--foreground)]">
        <b>5点の目安</b>：5点は「完成された学生」ではなく、
        <b>実際の選考でも高く評価される水準</b>です。基準は全員・全回で共通です。
      </div>

      {/* rubric */}
      <div className="mt-6 space-y-6">
        {props.rubric.map((item, idx) => {
          const anchors = item.anchors ?? {};
          const selected = scores[item.id];
          return (
            <fieldset key={item.id}>
              <legend className="font-semibold">
                {idx + 1}. {item.label}
              </legend>
              {item.description && (
                <p className="mb-2 text-xs text-[var(--muted-foreground)]">
                  {item.description}
                </p>
              )}
              <div className="space-y-1.5">
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = selected === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setScore(item.id, n)}
                      className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition ${
                        active
                          ? "border-[var(--accent)] bg-[var(--accent)]/10"
                          : "bg-[var(--card)]"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          active
                            ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                            : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                        }`}
                      >
                        {n}
                      </span>
                      <span className="text-sm leading-snug">
                        {anchors[String(n)] ?? `${n} 点`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      {/* good チップ */}
      <section className="mt-8">
        <h2 className="mb-1 font-semibold text-[var(--good)]">良かった点</h2>
        <p className="mb-2 text-xs text-[var(--muted-foreground)]">
          当てはまるものをタップ（複数可・任意）
        </p>
        <div className="flex flex-wrap gap-2">
          {goodOptions.map((o) => {
            const active = goodChips.has(o.id);
            return (
              <Chip key={o.id} active={active} tone="good" onClick={() => toggleGood(o.id)}>
                {o.text}
              </Chip>
            );
          })}
        </div>
      </section>

      {/* improve チップ */}
      <section className="mt-6">
        <h2 className="mb-1 font-semibold text-[var(--improve)]">改善点</h2>
        <p className="mb-2 text-xs text-[var(--muted-foreground)]">
          {props.mode === "amakuchi"
            ? "1つまで（甘口）・任意"
            : props.mode === "karakuchi"
            ? "2つ以上えらんでください（辛口）"
            : "当てはまるものをタップ（複数可・任意）"}
        </p>
        <div className="flex flex-wrap gap-2">
          {improveOptions.map((o) => {
            const active = improveChips.has(o.id);
            return (
              <Chip
                key={o.id}
                active={active}
                tone="improve"
                onClick={() => toggleImprove(o.id)}
              >
                {o.text}
              </Chip>
            );
          })}
        </div>
      </section>

      {/* 最優先の改善点（必須・単一） */}
      <section className="mt-8 rounded-xl border bg-[var(--card)] p-4">
        <h2 className="font-semibold">
          この人が次に直すべき点を1つだけ選ぶとしたら？
          <span className="ml-1 text-xs text-[var(--danger)]">必須</span>
        </h2>
        <p className="mb-3 mt-1 text-xs text-[var(--muted-foreground)]">
          1つだけ選んでください。
        </p>
        <div className="space-y-1.5">
          {improveOptions.map((o) => {
            const active = topImprovementId === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setTopImprovementId(o.id)}
                className={`flex w-full items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition ${
                  active
                    ? "border-[var(--improve)] bg-[var(--improve)]/10"
                    : "bg-[var(--card)]"
                }`}
              >
                <span
                  className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                    active
                      ? "border-[var(--improve)] bg-[var(--improve)]"
                      : "border-[var(--border)]"
                  }`}
                />
                {o.text}
              </button>
            );
          })}
        </div>
      </section>

      {/* 自由記述（任意） */}
      <section className="mt-6">
        <h2 className="font-semibold">
          ひとことメモ
          <span className="ml-1 text-xs text-[var(--muted-foreground)]">任意・空欄OK</span>
        </h2>
        <p className="mb-2 mt-1 text-xs text-[var(--muted-foreground)]">
          言葉にしづらければ空欄のままで大丈夫です。
        </p>
        <textarea
          value={freeNote}
          onChange={(e) => setFreeNote(e.target.value)}
          rows={3}
          placeholder="例：最初の一言が明るくて印象が良かったです"
          className="w-full rounded-lg border bg-[var(--card)] p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </section>

      {/* 送信バー（sticky） */}
      <div className="fixed inset-x-0 bottom-0 border-t bg-[var(--background)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 text-xs text-[var(--muted-foreground)]">
            {validation.ok ? (
              <span className="text-[var(--good)]">送信できます</span>
            ) : (
              <span>{validation.hints.join(" ・ ") || "未入力があります"}</span>
            )}
            {showErrors && !validation.ok && (
              <div className="text-[var(--danger)]">{validation.errors[0]}</div>
            )}
            {error && <div className="text-[var(--danger)]">{error}</div>}
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className={`shrink-0 rounded-lg px-5 py-2.5 font-medium text-[var(--accent-foreground)] disabled:opacity-60 ${
              validation.ok ? "bg-[var(--accent)]" : "bg-[var(--muted-foreground)]"
            }`}
          >
            {pending ? "送信中…" : props.alreadySubmitted ? "更新" : "送信"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Chip({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "good" | "improve";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const color = tone === "good" ? "var(--good)" : "var(--improve)";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-full border px-3 py-1.5 text-sm transition"
      style={
        active
          ? { borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }
          : undefined
      }
    >
      {children}
    </button>
  );
}
