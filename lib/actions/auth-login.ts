"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServiceRoleKey } from "@/lib/supabase/env";
import { usernameToEmail } from "@/lib/username";

export type LoginResult = { ok: true } | { ok: false; error: string };

// ユーザーネーム or メール でログイン。
// ユーザーネームの場合、service_role があればサーバー側でメールを解決する
// （メール登録者が"ユーザーネームのまま"ログインできる）。
// service_role 未設定なら合成メール(usernameToEmail)にフォールバックする
//   → 通常のユーザーネーム運用はキー無しでも動く。
export async function signInWithUsername(
  identifier: string,
  password: string
): Promise<LoginResult> {
  const id = identifier.trim();
  if (!id || !password) return { ok: false, error: "入力してください" };

  let email: string | null = null;

  if (id.includes("@")) {
    email = id.toLowerCase();
  } else {
    // service_role があれば正確に解決（メール登録者にも対応）
    if (getServiceRoleKey()) {
      try {
        const admin = createAdminClient();
        const { data } = await admin.rpc("resolve_login_email", { p_name: id });
        email = (data as string | null) ?? null;
      } catch {
        email = null;
      }
    }
    // 解決できなければ合成メールにフォールバック
    if (!email) email = usernameToEmail(id);
  }

  if (!email) {
    return { ok: false, error: "ユーザーネームかパスワードが違います。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      ok: false,
      error: error.message.toLowerCase().includes("invalid login credentials")
        ? "ユーザーネームかパスワードが違います。"
        : error.message,
    };
  }
  return { ok: true };
}
