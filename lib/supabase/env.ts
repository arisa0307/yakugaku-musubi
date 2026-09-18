/**
 * Supabase URL はプロジェクトルートのみ。
 * 例: https://xxxxxxxx.supabase.co （/rest/v1 は付けない）
 */
export function getSupabaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return "";
  return raw.replace(/\/$/, "").replace(/\/rest\/v1\/?$/i, "");
}

export function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
}

export function getAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return (raw && raw.replace(/\/$/, "")) || "http://localhost:3000";
}

// サーバー専用。ユーザーネーム→メール解決などに使う（クライアントに渡さない）。
export function getServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}
