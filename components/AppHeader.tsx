import Link from "next/link";
import { signOut } from "@/lib/actions/auth";

export function AppHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="mb-5 flex items-center justify-between border-b pb-3">
      <div>
        <Link href="/events" className="text-lg font-bold">
          薬学むすび
        </Link>
        {subtitle && (
          <p className="text-xs text-[var(--muted-foreground)]">{subtitle}</p>
        )}
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border px-3 py-1.5 text-xs text-[var(--muted-foreground)]"
        >
          ログアウト
        </button>
      </form>
    </header>
  );
}
