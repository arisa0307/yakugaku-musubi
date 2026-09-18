import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyButton } from "@/components/CopyButton";
import { getEvent, getMyProfile, getSessionUser } from "@/lib/data";
import { getAppUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  deleteEvent,
  regenerateJoinCode,
  removeParticipant,
  resetEvaluations,
  setEventStatus,
  upsertParticipant,
} from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

export default async function ManageEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [event, user, profile] = await Promise.all([
    getEvent(id),
    getSessionUser(),
    getMyProfile(),
  ]);

  if (!event || !user) notFound();

  const canManage = event.created_by === user.id || profile?.role === "admin";
  if (!canManage) {
    return (
      <div>
        <AppHeader />
        <div className="rounded-xl border bg-[var(--card)] p-5 text-sm text-[var(--muted-foreground)]">
          このイベントを管理する権限がありません（作成者か運営のみ）。
        </div>
        <div className="mt-4">
          <Link href={`/events/${id}`} className="text-sm text-[var(--accent)] underline">
            イベントへ戻る
          </Link>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: allProfiles }, { data: parts }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, role").order("display_name"),
    supabase
      .from("event_participants")
      .select("user_id, group_no")
      .eq("event_id", id),
  ]);

  const participants = parts ?? [];
  const partByUser = new Map(participants.map((p) => [p.user_id as string, p]));
  const profiles = (allProfiles ?? []) as {
    id: string;
    display_name: string;
    role: string;
  }[];

  const current = profiles
    .filter((p) => partByUser.has(p.id))
    .map((p) => ({ ...p, group_no: partByUser.get(p.id)?.group_no ?? null }))
    .sort((a, b) => (a.group_no ?? 999) - (b.group_no ?? 999));

  return (
    <div>
      <AppHeader subtitle="管理" />
      <div className="mb-4">
        <Link href={`/events/${id}`} className="text-sm text-[var(--muted-foreground)]">
          ← {event.title}
        </Link>
      </div>
      <h1 className="text-xl font-bold">{event.title}（管理）</h1>

      {/* ステータス */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm text-[var(--muted-foreground)]">状態: {event.status}</span>
        {(["open", "closed"] as const).map((s) => (
          <form
            key={s}
            action={async () => {
              "use server";
              await setEventStatus(id, s);
            }}
          >
            <button className="rounded-md border px-2.5 py-1 text-xs">
              {s === "open" ? "開催中にする" : "終了にする"}
            </button>
          </form>
        ))}
      </div>

      {/* 参加コード */}
      <section className="mt-5 rounded-xl border bg-[var(--card)] p-4">
        <h2 className="text-sm font-semibold">参加コード</h2>
        <p className="mb-2 mt-1 text-xs text-[var(--muted-foreground)]">
          参加者に共有 → 各自ログイン後「コードで参加」で入れます。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-[var(--muted)] px-4 py-2 text-2xl font-bold tracking-widest">
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
          <form
            action={async () => {
              "use server";
              await regenerateJoinCode(id);
            }}
          >
            <button className="rounded-md border px-2.5 py-1 text-xs">再発行</button>
          </form>
        </div>
      </section>

      {/* 参加者 */}
      <section className="mt-6">
        <h2 className="mb-1 font-semibold">参加者（{current.length}名）</h2>
        <p className="mb-2 text-xs text-[var(--muted-foreground)]">
          グループ分けは任意。番号を空欄のままにすると全員が1つのグループ（全員が互いの評価対象）になります。分けたいときだけ番号を振ってください。
        </p>
        {current.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            まだいません。参加コードを配って参加してもらうか、下から追加してください。
          </p>
        ) : (
          <ul className="space-y-2">
            {current.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-lg border bg-[var(--card)] p-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {p.display_name}
                  {p.id === user.id && (
                    <span className="ml-1 text-xs text-[var(--muted-foreground)]">(あなた)</span>
                  )}
                </span>
                <form action={upsertParticipant} className="flex items-center gap-1">
                  <input type="hidden" name="event_id" value={id} />
                  <input type="hidden" name="user_id" value={p.id} />
                  <label className="text-xs text-[var(--muted-foreground)]">Gr.</label>
                  <input
                    name="group_no"
                    type="number"
                    min={1}
                    defaultValue={p.group_no ?? ""}
                    className="w-14 rounded-md border bg-[var(--background)] px-2 py-1 text-sm"
                  />
                  <button className="rounded-md bg-[var(--accent)] px-2 py-1 text-xs text-[var(--accent-foreground)]">
                    保存
                  </button>
                </form>
                <form action={removeParticipant}>
                  <input type="hidden" name="event_id" value={id} />
                  <input type="hidden" name="user_id" value={p.id} />
                  <button className="rounded-md border px-2 py-1 text-xs text-[var(--danger)]">
                    削除
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 追加（手動フォールバック） */}
      <section className="mt-6">
        <h2 className="mb-2 font-semibold">参加者を手動で追加</h2>
        <p className="mb-2 text-xs text-[var(--muted-foreground)]">
          通常は参加コードで各自参加します。ここは補助（一度ログインした人のみ）。
        </p>
        {profiles.filter((p) => !partByUser.has(p.id)).length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">追加できる人がいません。</p>
        ) : (
          <ul className="space-y-2">
            {profiles
              .filter((p) => !partByUser.has(p.id))
              .map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border bg-[var(--card)] p-3"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{p.display_name}</span>
                  <form action={upsertParticipant} className="flex items-center gap-1">
                    <input type="hidden" name="event_id" value={id} />
                    <input type="hidden" name="user_id" value={p.id} />
                    <label className="text-xs text-[var(--muted-foreground)]">Gr.</label>
                    <input
                      name="group_no"
                      type="number"
                      min={1}
                      placeholder="1"
                      className="w-14 rounded-md border bg-[var(--background)] px-2 py-1 text-sm"
                    />
                    <button className="rounded-md border border-[var(--accent)] px-2 py-1 text-xs text-[var(--accent)]">
                      追加
                    </button>
                  </form>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* 危険な操作 */}
      <section className="mt-8 rounded-xl border border-[var(--danger)]/40 p-4">
        <h2 className="font-semibold text-[var(--danger)]">危険な操作</h2>
        <p className="mb-3 mt-1 text-xs text-[var(--muted-foreground)]">
          テストデータの掃除に。取り消せません。
        </p>
        <div className="flex flex-wrap gap-2">
          <ConfirmButton
            action={resetEvaluations.bind(null, id)}
            message="このイベントの評価をすべて削除します。よろしいですか？"
            className="rounded-md border border-[var(--danger)] px-3 py-1.5 text-xs text-[var(--danger)]"
          >
            評価をすべてリセット
          </ConfirmButton>
          <ConfirmButton
            action={deleteEvent.bind(null, id)}
            message="このイベントを削除します（参加者・評価も全て消えます）。よろしいですか？"
            className="rounded-md bg-[var(--danger)] px-3 py-1.5 text-xs font-medium text-white"
          >
            イベントを削除
          </ConfirmButton>
        </div>
      </section>
    </div>
  );
}
