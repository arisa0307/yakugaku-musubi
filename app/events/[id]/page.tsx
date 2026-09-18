import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { CopyButton } from "@/components/CopyButton";
import { HarshnessSelector } from "@/components/HarshnessSelector";
import { getAppUrl } from "@/lib/supabase/env";
import {
  getEvent,
  getMyProfile,
  getParticipantsWithProfiles,
  getSessionUser,
  getSubmittedEvaluateeIds,
} from "@/lib/data";
import { HARSHNESS_LABEL, isHarshness } from "@/lib/harshness";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [event, user, participants, submitted, profile] = await Promise.all([
    getEvent(id),
    getSessionUser(),
    getParticipantsWithProfiles(id),
    getSubmittedEvaluateeIds(id),
    getMyProfile(),
  ]);

  if (!event || !user) notFound();

  const canManage = event.created_by === user.id || profile?.role === "admin";

  const me = participants.find((p) => p.user_id === user.id);
  if (!me) {
    return (
      <div>
        <AppHeader subtitle={event.title} />
        <div className="rounded-xl border bg-[var(--card)] p-5 text-sm text-[var(--muted-foreground)]">
          このイベントの参加者ではありません。
          <Link href="/join" className="text-[var(--accent)] underline underline-offset-2">
            参加コード
          </Link>
          で参加できます。
        </div>
        {canManage && (
          <div className="mt-4">
            <Link
              href={`/events/${id}/manage`}
              className="text-sm text-[var(--accent)] underline underline-offset-2"
            >
              このイベントを管理する →
            </Link>
          </div>
        )}
      </div>
    );
  }

  // 同じグループの相手（自分を除く）
  const targets = participants
    .filter((p) => p.user_id !== user.id && p.group_no === me.group_no)
    .sort((a, b) => a.display_name.localeCompare(b.display_name, "ja"));

  const doneCount = targets.filter((t) => submitted.has(t.user_id)).length;
  const myHarshness = isHarshness(me.requested_harshness)
    ? me.requested_harshness
    : "chukara";

  const statusLabel =
    event.status === "open" ? "開催中" : event.status === "closed" ? "終了" : "準備中";
  const isOwner = event.created_by === user.id;

  return (
    <div>
      <AppHeader subtitle="参加中のイベント" />

      {/* 状態カード：入っているか・立場・グループが一目で分かる */}
      <div className="mb-5 rounded-xl border bg-[var(--card)] p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">{event.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-[var(--good)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--good)]">
                ✓ 参加中
              </span>
              <span className="rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-xs text-[var(--muted-foreground)]">
                {statusLabel}
              </span>
              <span className="rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-xs text-[var(--muted-foreground)]">
                {isOwner ? "あなたが主催" : "参加者"}
              </span>
              <span className="rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-xs text-[var(--muted-foreground)]">
                {me.group_no != null ? `グループ ${me.group_no}` : "グループ分けなし"}
              </span>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="mt-4 border-t pt-3">
            <p className="text-xs text-[var(--muted-foreground)]">参加コード（参加者に共有）</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-[var(--muted)] px-3 py-1.5 text-xl font-bold tracking-widest">
                {event.join_code ?? "—"}
              </span>
              {event.join_code && (
                <>
                  <CopyButton text={event.join_code} label="コードをコピー" />
                  <CopyButton
                    text={`${getAppUrl()}/join?code=${event.join_code}`}
                    label="参加リンクをコピー"
                  />
                </>
              )}
            </div>
            <div className="mt-3">
              <Link
                href={`/events/${id}/manage`}
                className="inline-block rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)]"
              >
                管理する（参加者・グループ・削除）
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* 自分の希望フィードバック強度 */}
      <section className="mb-6 rounded-xl border bg-[var(--card)] p-4">
        <h2 className="text-sm font-semibold">① 自分が受け取るフィードバックの強さ</h2>
        <p className="mb-3 mt-1 text-xs text-[var(--muted-foreground)]">
          点数の付け方は全員共通です。変わるのは「コメント」の量と厳しさだけ。
        </p>
        <HarshnessSelector eventId={id} initial={myHarshness} />
      </section>

      {/* 評価すべき相手 */}
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">② 評価する相手</h2>
          <span className="text-xs text-[var(--muted-foreground)]">
            {doneCount} / {targets.length} 件 送信済み
          </span>
        </div>

        {targets.length === 0 ? (
          <div className="rounded-xl border bg-[var(--card)] p-4 text-sm text-[var(--muted-foreground)]">
            {me.group_no != null
              ? "同じグループにまだ相手がいません。グループ番号の割り当てを確認してください。"
              : "まだ他の参加者がいません。参加コードを共有して参加してもらってください。"}
          </div>
        ) : (
          <ul className="space-y-2">
            {targets.map((t) => {
              const done = submitted.has(t.user_id);
              return (
                <li key={t.user_id}>
                  <Link
                    href={`/events/${id}/evaluate/${t.user_id}`}
                    className="flex items-center justify-between rounded-xl border bg-[var(--card)] p-4 transition hover:border-[var(--accent)]"
                  >
                    <div>
                      <span className="font-medium">{t.display_name}</span>
                      <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                        希望: {HARSHNESS_LABEL[isHarshness(t.requested_harshness) ? t.requested_harshness : "chukara"]}
                      </span>
                    </div>
                    {done ? (
                      <span className="rounded-full bg-[var(--good)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--good)]">
                        送信済み
                      </span>
                    ) : (
                      <span className="rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-xs text-[var(--muted-foreground)]">
                        未送信
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 自分あてフィードバック */}
      <section>
        <Link
          href={`/events/${id}/feedback`}
          className="block rounded-xl border border-[var(--accent)] bg-[var(--accent)]/5 p-4 text-center font-medium text-[var(--accent)]"
        >
          ③ 自分が受けたフィードバックを見る →
        </Link>
      </section>
    </div>
  );
}
