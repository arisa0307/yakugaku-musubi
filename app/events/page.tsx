import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getMyEvents, getMyProfile, getSessionUser } from "@/lib/data";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "準備中",
  open: "開催中",
  closed: "終了",
};

function formatDate(iso: string | null): string {
  if (!iso) return "日時未定";
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EventsPage() {
  const [events, profile, user] = await Promise.all([
    getMyEvents(),
    getMyProfile(),
    getSessionUser(),
  ]);

  return (
    <div>
      <AppHeader subtitle={profile ? `${profile.display_name} さん` : undefined} />

      <div className="mb-1 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">参加中のイベント</h1>
        <div className="flex gap-2">
          <Link
            href="/events/new"
            className="rounded-lg border border-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent)]"
          >
            作成
          </Link>
          <Link
            href="/join"
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-foreground)]"
          >
            コードで参加
          </Link>
        </div>
      </div>
      <p className="mb-4 text-xs text-[var(--muted-foreground)]">
        ここに出るのは、あなたが参加中のイベントです。新しく開くなら「作成」、
        コードをもらったら「コードで参加」。
      </p>

      {events.length === 0 ? (
        <div className="rounded-xl border bg-[var(--card)] p-5 text-sm text-[var(--muted-foreground)]">
          まだ参加イベントがありません。運営から共有された
          <Link href="/join" className="text-[var(--accent)] underline underline-offset-2">
            参加コード
          </Link>
          を入力すると参加できます。
        </div>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/events/${e.id}`}
                className="block rounded-xl border bg-[var(--card)] p-4 transition hover:border-[var(--accent)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">{e.title}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {user && e.created_by === user.id && (
                      <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                        主催
                      </span>
                    )}
                    <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
                      {STATUS_LABEL[e.status] ?? e.status}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {formatDate(e.scheduled_at)} ・ 開くと評価・結果へ
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex gap-4">
        <Link
          href="/history"
          className="text-sm text-[var(--accent)] underline underline-offset-2"
        >
          スコア推移
        </Link>
        <Link
          href="/account"
          className="text-sm text-[var(--accent)] underline underline-offset-2"
        >
          パスワード設定
        </Link>
        {profile?.role === "admin" && (
          <Link
            href="/admin"
            className="text-sm text-[var(--accent)] underline underline-offset-2"
          >
            管理画面へ
          </Link>
        )}
      </div>
    </div>
  );
}
