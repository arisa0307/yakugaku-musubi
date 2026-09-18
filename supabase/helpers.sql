-- ============================================================================
-- 運用ヘルパー SQL（Supabase SQL Editor で必要なときに実行）
-- 0001_init.sql を先に適用しておくこと。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) 自分を管理者(admin)にする
--    ※ 一度アプリに新規登録/ログインして profiles 行ができてから実行。
--    ※ ユーザーネーム方式なので「表示名（=ユーザーネーム）」で指定する。
--    ※ 'ありさ' を自分のユーザーネームに置き換える。
-- ----------------------------------------------------------------------------
update public.profiles
set role = 'admin'
where display_name = 'ありさ';

-- （旧・メール方式で作ったアカウントの場合はこちら）
-- update public.profiles p set role='admin'
-- from auth.users u where u.id=p.id and u.email='you@example.com';

-- 誰が admin か確認
-- select p.id, p.display_name, p.role, u.email
-- from public.profiles p join auth.users u on u.id = p.id
-- order by p.role desc;

-- ----------------------------------------------------------------------------
-- 2) 表示名を手動で整える（任意）
-- ----------------------------------------------------------------------------
-- update public.profiles set display_name = '山田 太郎'
-- from auth.users u where u.id = profiles.id and u.email = 'yamada@example.com';

-- ----------------------------------------------------------------------------
-- 3) 管理画面を使わず SQL だけでイベント＋参加者を用意する場合の例
--    （P1 admin が間に合わないときの代替）
-- ----------------------------------------------------------------------------
-- do $$
-- declare
--   ev uuid;
-- begin
--   insert into public.events (title, status, scheduled_at)
--   values ('第1回 模擬面接会', 'open', '2026-09-23 19:00+09')
--   returning id into ev;
--
--   -- メールから user_id を引いてグループ番号を割り当てる
--   insert into public.event_participants (event_id, user_id, group_no)
--   select ev, u.id,
--          case when u.email in ('a@x.com','b@x.com','c@x.com','d@x.com') then 1 else 2 end
--   from auth.users u
--   where u.email in ('a@x.com','b@x.com','c@x.com','d@x.com',
--                     'e@x.com','f@x.com','g@x.com','h@x.com')
--   on conflict (event_id, user_id) do nothing;
-- end $$;

-- ----------------------------------------------------------------------------
-- 4) あるイベントの匿名性の自己点検（評価者本人以外は evaluations を読めないこと）
--    ※ これは postgres ロールでの確認。実アクセスは anon/authenticated 経由。
-- ----------------------------------------------------------------------------
-- select count(*) as total_evaluations from public.evaluations;
