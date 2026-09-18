"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateJoinCode } from "@/lib/join-code";

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// イベント作成：ログイン済みなら誰でも。作成者がオーナー＆参加者になる。
export async function createEvent(formData: FormData) {
  const { supabase, user } = await getUser();
  if (!user) return;

  const title = String(formData.get("title") ?? "").trim();
  const scheduledRaw = String(formData.get("scheduled_at") ?? "").trim();
  if (!title) return;

  const scheduled_at = scheduledRaw ? new Date(scheduledRaw).toISOString() : null;

  let eventId: string | undefined;
  for (let i = 0; i < 5; i++) {
    const { data, error } = await supabase
      .from("events")
      .insert({
        title,
        scheduled_at,
        status: "open",
        created_by: user.id,
        join_code: generateJoinCode(),
      })
      .select("id")
      .single();
    if (!error && data) {
      eventId = data.id as string;
      break;
    }
    if (error && !error.message.toLowerCase().includes("join_code")) break;
  }
  if (!eventId) return;

  // 作成者を参加者として自動登録
  await supabase
    .from("event_participants")
    .upsert({ event_id: eventId, user_id: user.id }, { onConflict: "event_id,user_id" });

  revalidatePath("/events");
  revalidatePath("/admin");
  redirect(`/events/${eventId}/manage`);
}

export async function deleteEvent(eventId: string) {
  const { supabase, user } = await getUser();
  if (!user) return;

  // RLS が owner or admin のみ許可（それ以外は0件削除）
  await supabase.from("events").delete().eq("id", eventId);

  revalidatePath("/events");
  revalidatePath("/admin");
  redirect("/events");
}

// 評価だけ全消し（テストのやり直し用）。イベント自体は残す。
export async function resetEvaluations(eventId: string) {
  const { supabase, user } = await getUser();
  if (!user) return;

  await supabase.from("evaluations").delete().eq("event_id", eventId);

  revalidatePath(`/events/${eventId}/manage`);
  revalidatePath(`/events/${eventId}`);
}

export async function setEventStatus(eventId: string, status: string) {
  const { supabase, user } = await getUser();
  if (!user) return;
  if (!["draft", "open", "closed"].includes(status)) return;

  await supabase.from("events").update({ status }).eq("id", eventId);
  revalidatePath(`/events/${eventId}/manage`);
  revalidatePath("/admin");
}

export async function regenerateJoinCode(eventId: string) {
  const { supabase, user } = await getUser();
  if (!user) return;

  for (let i = 0; i < 5; i++) {
    const { error } = await supabase
      .from("events")
      .update({ join_code: generateJoinCode() })
      .eq("id", eventId);
    if (!error) break;
  }
  revalidatePath(`/events/${eventId}/manage`);
}

export async function upsertParticipant(formData: FormData) {
  const { supabase, user } = await getUser();
  if (!user) return;

  const eventId = String(formData.get("event_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const groupRaw = String(formData.get("group_no") ?? "").trim();
  if (!eventId || !userId) return;

  const group_no = groupRaw === "" ? null : Number(groupRaw);

  await supabase
    .from("event_participants")
    .upsert({ event_id: eventId, user_id: userId, group_no }, { onConflict: "event_id,user_id" });

  revalidatePath(`/events/${eventId}/manage`);
}

export async function removeParticipant(formData: FormData) {
  const { supabase, user } = await getUser();
  if (!user) return;

  const eventId = String(formData.get("event_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  if (!eventId || !userId) return;

  await supabase
    .from("event_participants")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);

  revalidatePath(`/events/${eventId}/manage`);
}
