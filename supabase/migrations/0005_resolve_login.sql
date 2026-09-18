-- ============================================================================
-- ユーザーネーム→ログイン用メール の解決（サーバー専用）
--   リカバリー用メールを登録するとアカウントのメールが本物に変わるが、
--   ログインは引き続き「ユーザーネーム」で行えるようにするための解決関数。
--
--   ★ メールアドレスは他人に見せない：この関数は service_role からのみ実行可能にし、
--     サーバーアクション内でのみ使う（anon/authenticated には権限を与えない）。
-- ============================================================================

create or replace function public.resolve_login_email(p_name text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.display_name) = lower(btrim(p_name))
  limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
revoke all on function public.resolve_login_email(text) from anon;
revoke all on function public.resolve_login_email(text) from authenticated;
grant execute on function public.resolve_login_email(text) to service_role;
