"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type JoinResult =
  | { ok: true; eventId: string; title: string }
  | { ok: false; error: string };

export async function joinEventByCode(code: string): Promise<JoinResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const { data, error } = await supabase.rpc("join_event_by_code", {
    p_code: code,
  });

  if (error) return { ok: false, error: error.message };

  const res = data as { ok: boolean; error?: string; event_id?: string; title?: string };
  if (!res?.ok) return { ok: false, error: res?.error ?? "参加できませんでした" };

  revalidatePath("/events");
  return { ok: true, eventId: res.event_id!, title: res.title ?? "" };
}
