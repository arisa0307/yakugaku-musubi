-- ============================================================================
-- ユーザーネームの一意性担保と、重複チェック用RPC
--   ・ユーザーネーム方式では display_name がログイン用の一意キーになる。
--     （希望者がリカバリー用メールを登録するとメールがログインにも使えるが、
--      その場合でも表示名の重複は避けたいので DB で一意制約をかける。）
-- ============================================================================

-- 大文字小文字を区別しない一意制約
create unique index if not exists idx_profiles_display_name_lower
  on public.profiles (lower(display_name));

-- 新規登録前の空き確認（未ログインからも呼ぶので anon にも grant）
create or replace function public.username_available(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from public.profiles
    where lower(display_name) = lower(btrim(p_name))
  );
$$;

grant execute on function public.username_available(text) to anon, authenticated;
