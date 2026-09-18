import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getMyProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { createEvent } from "@/lib/actions/admin";
import type { EventRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const profile = await getMyProfile();

  if (profile?.role !== "admin") {
    return (
      <div>
        <AppHeader />
        <div className="rounded-xl border bg-[var(--card)] p-5 text-sm text-[var(--muted-foreground)]">
          管理者権限がありません。
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, title, scheduled_at, status, created_by, join_code")
    .order("created_at", { ascending: false });

  const list = (events as EventRow[]) ?? [];

  return (
    <div>
      <AppHeader subtitle="管理" />
      <h1 className="mb-4 text-xl font-bold">管理画面</h1>

      <section className="mb-8 rounded-xl border bg-[var(--card)] p-4">
        <h2 className="mb-3 font-semibold">イベントを作成</h2>
        <form action={createEvent} className="space-y-3">
          <label className="block">
            <span className="text-sm">タイトル</span>
            <input
              name="title"
              required
              placeholder="第1回 模擬面接会"
              className="mt-1 w-full rounded-lg border bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>
          <label className="block">
            <span className="text-sm">日時（任意）</span>
            <input
              name="scheduled_at"
              type="datetime-local"
              className="mt-1 w-full rounded-lg border bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)]"
          >
            作成
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">イベント一覧</h2>
        {list.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">まだありません。</p>
        ) : (
          <ul className="space-y-2">
            {list.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/events/${e.id}/manage`}
                  className="flex items-center justify-between rounded-xl border bg-[var(--card)] p-4 transition hover:border-[var(--accent)]"
                >
                  <span className="font-medium">{e.title}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {e.status} ・ 管理 →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
