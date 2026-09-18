"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isHarshness, validateEvaluation, type Harshness } from "@/lib/harshness";

export type SubmitEvaluationInput = {
  eventId: string;
  evaluateeId: string;
  scores: Record<string, number>; // rubric_item_id -> score(1-5)
  goodChipIds: string[];
  improveChipIds: string[];
  topImprovementId: string;
  freeNote: string;
};

export type SubmitResult = { ok: true } | { ok: false; error: string };

export async function submitEvaluation(
  input: SubmitEvaluationInput
): Promise<SubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  if (user.id === input.evaluateeId) {
    return { ok: false, error: "自分自身は評価できません" };
  }

  // 対象者の希望強度をサーバー側で取得（クライアントを信用しない）
  const { data: targetPart } = await supabase
    .from("event_participants")
    .select("requested_harshness")
    .eq("event_id", input.eventId)
    .eq("user_id", input.evaluateeId)
    .maybeSingle();

  if (!targetPart) {
    return { ok: false, error: "評価対象がこのイベントの参加者ではありません" };
  }
  const mode: Harshness = isHarshness(targetPart.requested_harshness)
    ? targetPart.requested_harshness
    : "chukara";

  // rubric 項目を取得（イベント固有 or 共通）
  const { data: specificRubric } = await supabase
    .from("rubric_items")
    .select("id")
    .eq("event_id", input.eventId);
  let rubricIds = (specificRubric ?? []).map((r) => r.id as string);
  if (rubricIds.length === 0) {
    const { data: commonRubric } = await supabase
      .from("rubric_items")
      .select("id")
      .is("event_id", null);
    rubricIds = (commonRubric ?? []).map((r) => r.id as string);
  }

  // スコア検証
  const scoredIds = rubricIds.filter((id) => {
    const s = input.scores[id];
    return typeof s === "number" && s >= 1 && s <= 5;
  });

  const improveChipCount = input.improveChipIds.length;
  const validation = validateEvaluation({
    mode,
    scoredCount: scoredIds.length,
    totalRubric: rubricIds.length,
    improveChipCount,
    hasTopImprovement: Boolean(input.topImprovementId),
  });
  if (!validation.ok) {
    return { ok: false, error: validation.errors.join(" / ") };
  }

  // top_improvement が improve の comment_option か検証
  const { data: topOpt } = await supabase
    .from("comment_options")
    .select("id, kind")
    .eq("id", input.topImprovementId)
    .maybeSingle();
  if (!topOpt || topOpt.kind !== "improve") {
    return { ok: false, error: "「最優先の改善点」の選択が不正です" };
  }

  const freeNote = input.freeNote.trim();

  // evaluation を upsert（再送信＝上書き）
  const { data: evalRow, error: upsertErr } = await supabase
    .from("evaluations")
    .upsert(
      {
        event_id: input.eventId,
        evaluator_id: user.id,
        evaluatee_id: input.evaluateeId,
        free_note: freeNote === "" ? null : freeNote,
        top_improvement_id: input.topImprovementId,
      },
      { onConflict: "event_id,evaluator_id,evaluatee_id" }
    )
    .select("id")
    .single();

  if (upsertErr || !evalRow) {
    return { ok: false, error: upsertErr?.message ?? "保存に失敗しました" };
  }
  const evaluationId = evalRow.id as string;

  // 既存の子レコードを消してから入れ直す（冪等）
  await supabase.from("evaluation_scores").delete().eq("evaluation_id", evaluationId);
  await supabase.from("evaluation_comments").delete().eq("evaluation_id", evaluationId);

  const scoreRows = scoredIds.map((rid) => ({
    evaluation_id: evaluationId,
    rubric_item_id: rid,
    score: input.scores[rid],
  }));
  if (scoreRows.length > 0) {
    const { error } = await supabase.from("evaluation_scores").insert(scoreRows);
    if (error) return { ok: false, error: error.message };
  }

  const chipIds = Array.from(new Set([...input.goodChipIds, ...input.improveChipIds]));
  if (chipIds.length > 0) {
    const commentRows = chipIds.map((cid) => ({
      evaluation_id: evaluationId,
      comment_option_id: cid,
    }));
    const { error } = await supabase.from("evaluation_comments").insert(commentRows);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/events/${input.eventId}`);
  revalidatePath(`/events/${input.eventId}/feedback`);
  return { ok: true };
}
