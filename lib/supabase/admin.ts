import { createClient } from "@supabase/supabase-js";
import { getServiceRoleKey, getSupabaseUrl } from "./env";

// サーバー専用の管理クライアント（service_role）。RLSをバイパスするため
// サーバーアクション内でのみ使用し、絶対にクライアントへ渡さないこと。
export function createAdminClient() {
  const url = getSupabaseUrl();
  const key = getServiceRoleKey();
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY が未設定です（.env.local に追加してください）");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
