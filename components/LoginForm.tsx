"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getAppUrl } from "@/lib/supabase/env";
import { signInWithUsername } from "@/lib/actions/auth-login";
import { usernameByteLength, usernameToEmail, USERNAME_MAX_BYTES } from "@/lib/username";

type Tab = "login" | "signup" | "reset";

export function LoginForm({ urlError }: { urlError?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");

  const [identifier, setIdentifier] = useState(""); // ユーザーネーム or メール
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    urlError ? "セッションの有効期限が切れました。もう一度ログインしてください。" : ""
  );
  const [info, setInfo] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const id = identifier.trim();
    if (!id || !password) return;
    setBusy(true);
    setError("");

    // ユーザーネーム→メール解決はサーバー側で行う
    const res = await signInWithUsername(id, password);
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    router.push("/events");
    router.refresh();
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const name = identifier.trim();
    if (!name || !password) return;
    if (name.includes("@")) {
      setError("ユーザーネームに @ は使えません。メールは登録後に /account で追加できます。");
      return;
    }
    if (usernameByteLength(name) > USERNAME_MAX_BYTES) {
      setError("ユーザーネームが長すぎます（日本語なら10文字程度まで）。");
      return;
    }
    setBusy(true);
    setError("");

    const supabase = createClient();

    const { data: available } = await supabase.rpc("username_available", { p_name: name });
    if (available === false) {
      setError("そのユーザーネームは既に使われています。別の名前にしてください。");
      setBusy(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: usernameToEmail(name),
      password,
      options: { data: { display_name: name } },
    });
    if (error) {
      setError(
        error.message.toLowerCase().includes("already registered")
          ? "そのユーザーネームは既に使われています。別の名前にしてください。"
          : error.message
      );
      setBusy(false);
      return;
    }
    if (data.session) {
      router.push("/events");
      router.refresh();
      return;
    }
    setError(
      "登録は作成されましたが入れませんでした。管理者に「Confirm email をオフ」にしてもらってください。"
    );
    setBusy(false);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    const mail = resetEmail.trim();
    if (!mail || !mail.includes("@")) {
      setError("登録したメールアドレスを入力してください。");
      return;
    }
    setBusy(true);
    setError("");
    setInfo("");

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(mail.toLowerCase(), {
      redirectTo: `${getAppUrl()}/auth/callback?next=/account`,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setInfo("再設定用のリンクをメールで送りました（リカバリー用メールを登録済みの場合のみ届きます）。");
  }

  return (
    <div className="mt-10">
      <h1 className="text-2xl font-bold">薬学むすび</h1>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">模擬面接 相互評価</p>

      <div className="mt-8 grid grid-cols-2 gap-1 rounded-lg bg-[var(--muted)] p-1 text-sm">
        <button
          type="button"
          onClick={() => {
            setTab("login");
            setError("");
            setInfo("");
          }}
          className={`rounded-md py-2 font-medium ${
            tab !== "signup" ? "bg-[var(--card)] shadow-sm" : "text-[var(--muted-foreground)]"
          }`}
        >
          ログイン
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("signup");
            setError("");
            setInfo("");
          }}
          className={`rounded-md py-2 font-medium ${
            tab === "signup" ? "bg-[var(--card)] shadow-sm" : "text-[var(--muted-foreground)]"
          }`}
        >
          新規登録
        </button>
      </div>

      {tab === "reset" ? (
        <form onSubmit={handleReset} className="mt-6 space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            リカバリー用メールを登録している場合、再設定リンクを送れます。
          </p>
          <label className="block">
            <span className="text-sm font-medium">登録したメールアドレス</span>
            <input
              type="email"
              inputMode="email"
              required
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border bg-[var(--card)] px-3 py-3 text-base outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          {info && <p className="text-sm text-[var(--accent)]">{info}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 font-medium text-[var(--accent-foreground)] disabled:opacity-60"
          >
            {busy ? "送信中…" : "再設定リンクを送る"}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("login");
              setError("");
              setInfo("");
            }}
            className="w-full text-center text-sm text-[var(--accent)] underline underline-offset-2"
          >
            ログインに戻る
          </button>
        </form>
      ) : (
        <form onSubmit={tab === "signup" ? handleSignup : handleLogin} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">
              {tab === "signup" ? "ユーザーネーム" : "ユーザーネーム または メール"}
            </span>
            <input
              type="text"
              autoComplete="username"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={tab === "signup" ? "例：ありさ / arisa" : "ユーザーネーム or you@example.com"}
              className="mt-1 w-full rounded-lg border bg-[var(--card)] px-3 py-3 text-base outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">パスワード</span>
            <input
              type="password"
              autoComplete={tab === "signup" ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6文字以上"
              className="mt-1 w-full rounded-lg border bg-[var(--card)] px-3 py-3 text-base outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>

          {tab === "signup" && (
            <p className="text-xs text-[var(--muted-foreground)]">
              メール不要。ユーザーネームは他の参加者にも表示されます（大文字小文字は区別しません）。
              希望者は登録後に /account でリカバリー用メールを追加できます。
            </p>
          )}
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          {info && <p className="text-sm text-[var(--accent)]">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 font-medium text-[var(--accent-foreground)] disabled:opacity-60"
          >
            {busy ? "処理中…" : tab === "signup" ? "新規登録して入る" : "ログイン"}
          </button>

          {tab !== "signup" && (
            <button
              type="button"
              onClick={() => {
                setTab("reset");
                setError("");
                setInfo("");
              }}
              className="w-full text-center text-sm text-[var(--accent)] underline underline-offset-2"
            >
              パスワードを忘れた方（メール登録済みの方）
            </button>
          )}
        </form>
      )}
    </div>
  );
}
