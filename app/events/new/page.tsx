import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { createEvent } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

export default function NewEventPage() {
  return (
    <div>
      <AppHeader />
      <div className="mb-4">
        <Link href="/events" className="text-sm text-[var(--muted-foreground)]">
          ← イベント一覧
        </Link>
      </div>

      <h1 className="text-xl font-bold">イベントを作成</h1>
      <p className="mb-6 mt-1 text-sm text-[var(--muted-foreground)]">
        作成すると参加コードが発行され、あなたが管理者になります。
      </p>

      <form action={createEvent} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">タイトル</span>
          <input
            name="title"
            required
            placeholder="第1回 模擬面接会"
            className="mt-1 w-full rounded-lg border bg-[var(--card)] px-3 py-3 text-base outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">日時（任意）</span>
          <input
            name="scheduled_at"
            type="datetime-local"
            className="mt-1 w-full rounded-lg border bg-[var(--card)] px-3 py-3 text-base outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 font-medium text-[var(--accent-foreground)]"
        >
          作成する
        </button>
      </form>
    </div>
  );
}
