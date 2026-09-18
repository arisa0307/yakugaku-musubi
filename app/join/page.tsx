import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { JoinForm } from "@/components/JoinForm";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  return (
    <div>
      <AppHeader />
      <div className="mb-4">
        <Link href="/events" className="text-sm text-[var(--muted-foreground)]">
          ← イベント一覧
        </Link>
      </div>

      <h1 className="text-xl font-bold">コードでイベントに参加</h1>
      <p className="mb-6 mt-1 text-sm text-[var(--muted-foreground)]">
        運営から共有された参加コードを入力してください。
      </p>

      <JoinForm initialCode={code ?? ""} />
    </div>
  );
}
