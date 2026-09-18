import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { PasswordSettings } from "@/components/PasswordSettings";
import { RecoveryEmail } from "@/components/RecoveryEmail";
import { getMyProfile, getSessionUser } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const [profile, user] = await Promise.all([getMyProfile(), getSessionUser()]);

  // ダミーメール（@yakugaku.invalid）は「未登録」とみなす
  const rawEmail = user?.email ?? null;
  const realEmail = rawEmail && !rawEmail.endsWith("@yakugaku.invalid") ? rawEmail : null;

  return (
    <div>
      <AppHeader />
      <div className="mb-4">
        <Link href="/events" className="text-sm text-[var(--muted-foreground)]">
          ← イベント一覧
        </Link>
      </div>

      <h1 className="text-xl font-bold">アカウント設定</h1>
      {profile && (
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          ユーザーネーム：{profile.display_name}
        </p>
      )}

      <section className="mt-6 rounded-xl border bg-[var(--card)] p-4">
        <h2 className="font-semibold">パスワードを変更</h2>
        <p className="mb-3 mt-1 text-xs text-[var(--muted-foreground)]">
          新しいパスワードを設定します。ユーザーネームはそのまま使えます。
        </p>
        <PasswordSettings />
      </section>

      <section className="mt-6 rounded-xl border bg-[var(--card)] p-4">
        <h2 className="font-semibold">リカバリー用メール（任意）</h2>
        <p className="mb-3 mt-1 text-xs text-[var(--muted-foreground)]">
          登録しておくと、パスワードを忘れたときにメールで再設定できます。
          登録後も<b>ユーザーネームのままログイン</b>できます（メールでもログイン可）。
          不要な方は登録しなくて大丈夫です。
        </p>
        <RecoveryEmail currentEmail={realEmail} />
      </section>
    </div>
  );
}
