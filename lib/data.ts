import { createClient } from "@/lib/supabase/server";
import type {
  CommentOption,
  EventRow,
  Participant,
  Profile,
  RubricItem,
} from "@/lib/types";

/** ログイン中ユーザー。未ログインは null。 */
export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  return (data as Profile | null) ?? null;
}

/** 自分が参加しているイベント一覧（新しい順）。 */
export async function getMyEvents(): Promise<EventRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: parts } = await supabase
    .from("event_participants")
    .select("event_id")
    .eq("user_id", user.id);

  const ids = (parts ?? []).map((p) => p.event_id as string);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("events")
    .select("id, title, scheduled_at, status, created_by, join_code")
    .in("id", ids)
    .order("scheduled_at", { ascending: false, nullsFirst: false });

  return (data as EventRow[]) ?? [];
}

export async function getEvent(eventId: string): Promise<EventRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, title, scheduled_at, status, created_by, join_code")
    .eq("id", eventId)
    .maybeSingle();
  return (data as EventRow | null) ?? null;
}

/** 指定イベントの参加者（プロフィール付き）。 */
export async function getParticipantsWithProfiles(
  eventId: string
): Promise<(Participant & { display_name: string })[]> {
  const supabase = await createClient();

  const { data: parts } = await supabase
    .from("event_participants")
    .select("id, event_id, user_id, group_no, requested_harshness")
    .eq("event_id", eventId);

  const participants = (parts as Participant[]) ?? [];
  if (participants.length === 0) return [];

  const userIds = participants.map((p) => p.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);

  const nameById = new Map<string, string>(
    (profiles ?? []).map((p) => [p.id as string, (p.display_name as string) || "（名前未設定）"])
  );

  return participants.map((p) => ({
    ...p,
    display_name: nameById.get(p.user_id) ?? "（名前未設定）",
  }));
}

/** rubric（イベント固有があればそれ、なければ共通デフォルト）。 */
export async function getRubricItems(eventId: string): Promise<RubricItem[]> {
  const supabase = await createClient();

  const { data: specific } = await supabase
    .from("rubric_items")
    .select("id, event_id, sort_order, label, description, min_score, max_score, anchors")
    .eq("event_id", eventId)
    .order("sort_order");

  if (specific && specific.length > 0) return specific as RubricItem[];

  const { data: common } = await supabase
    .from("rubric_items")
    .select("id, event_id, sort_order, label, description, min_score, max_score, anchors")
    .is("event_id", null)
    .order("sort_order");

  return (common as RubricItem[]) ?? [];
}

/** comment_options（イベント固有があればそれ、なければ共通デフォルト）。 */
export async function getCommentOptions(eventId: string): Promise<CommentOption[]> {
  const supabase = await createClient();

  const { data: specific } = await supabase
    .from("comment_options")
    .select("id, event_id, kind, text, sort_order, min_harshness")
    .eq("event_id", eventId)
    .order("sort_order");

  if (specific && specific.length > 0) return specific as CommentOption[];

  const { data: common } = await supabase
    .from("comment_options")
    .select("id, event_id, kind, text, sort_order, min_harshness")
    .is("event_id", null)
    .order("sort_order");

  return (common as CommentOption[]) ?? [];
}

/** 自分がこのイベントで評価を送信済みの相手（evaluatee_id）の集合。 */
export async function getSubmittedEvaluateeIds(eventId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data } = await supabase
    .from("evaluations")
    .select("evaluatee_id")
    .eq("event_id", eventId)
    .eq("evaluator_id", user.id);

  return new Set((data ?? []).map((r) => r.evaluatee_id as string));
}
