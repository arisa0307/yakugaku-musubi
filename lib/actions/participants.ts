"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isHarshness } from "@/lib/harshness";

export async function setMyHarshness(
  eventId: string,
  harshness: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isHarshness(harshness)) return { ok: false, error: "不正な値です" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const { error } = await supabase
    .from("event_participants")
    .update({ requested_harshness: harshness })
    .eq("event_id", eventId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}
