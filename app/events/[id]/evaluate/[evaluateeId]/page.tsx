import Link from "next/link";
import { notFound } from "next/navigation";
import { EvaluateForm } from "@/components/EvaluateForm";
import {
  getCommentOptions,
  getEvent,
  getParticipantsWithProfiles,
  getRubricItems,
  getSessionUser,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { isHarshness } from "@/lib/harshness";

export const dynamic = "force-dynamic";

export default async function EvaluatePage({
  params,
}: {
  params: Promise<{ id: string; evaluateeId: string }>;
}) {
  const { id, evaluateeId } = await params;

  const [event, user, participants, rubric, commentOptions] = await Promise.all([
    getEvent(id),
    getSessionUser(),
    getParticipantsWithProfiles(id),
    getRubricItems(id),
    getCommentOptions(id),
  ]);

  if (!event || !user) notFound();
  if (user.id === evaluateeId) notFound();

  const evaluatee = participants.find((p) => p.user_id === evaluateeId);
  if (!evaluatee) notFound();

  const mode = isHarshness(evaluatee.requested_harshness)
    ? evaluatee.requested_harshness
    : "chukara";

  // 既存の自分の評価を取得（あれば編集）
  const supabase = await createClient();
  const { data: existingEval } = await supabase
    .from("evaluations")
    .select("id, free_note, top_improvement_id")
    .eq("event_id", id)
    .eq("evaluator_id", user.id)
    .eq("evaluatee_id", evaluateeId)
    .maybeSingle();

  let initialScores: Record<string, number> = {};
  let initialChipIds: string[] = [];
  if (existingEval) {
    const [{ data: scoreRows }, { data: commentRows }] = await Promise.all([
      supabase
        .from("evaluation_scores")
        .select("rubric_item_id, score")
        .eq("evaluation_id", existingEval.id),
      supabase
        .from("evaluation_comments")
        .select("comment_option_id")
        .eq("evaluation_id", existingEval.id),
    ]);
    initialScores = Object.fromEntries(
      (scoreRows ?? []).map((r) => [r.rubric_item_id as string, r.score as number])
    );
    initialChipIds = (commentRows ?? []).map((r) => r.comment_option_id as string);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/events/${id}`}
          className="text-sm text-[var(--muted-foreground)]"
        >
          ← {event.title}
        </Link>
        <Link
          href="/events"
          className="rounded-md border px-3 py-1.5 text-xs text-[var(--foreground)]"
        >
          ホーム
        </Link>
      </div>

      <EvaluateForm
        eventId={id}
        evaluateeId={evaluateeId}
        evaluateeName={evaluatee.display_name}
        mode={mode}
        rubric={rubric}
        commentOptions={commentOptions}
        initialScores={initialScores}
        initialChipIds={initialChipIds}
        initialTopImprovementId={existingEval?.top_improvement_id ?? ""}
        initialFreeNote={existingEval?.free_note ?? ""}
        alreadySubmitted={Boolean(existingEval)}
      />
    </div>
  );
}
