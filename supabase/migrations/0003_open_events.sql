-- ============================================================================
-- 一般参加者もイベントを作成できるように / オーナー・adminによる削除
--
--   ・イベント作成: ログイン済みなら誰でも（本人が created_by）。
--   ・作成者(オーナー)は自分のイベントを管理できる（参加者・コード・状態・削除）。
--   ・削除: オーナー or admin。評価のリセット(削除)も同様。
--
--   ★ 匿名性は維持: オーナーでも evaluations 等の「中身」は読めない
--     （evaluations の SELECT は評価者本人と admin のみのまま変更しない）。
--     オーナーに許すのは「管理操作」だけ。
-- ============================================================================

-- 現在のユーザーがそのイベントのオーナーか
create or replace function public.is_event_owner(e uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.events ev
    where ev.id = e and ev.created_by = auth.uid()
  );
$$;

-- events: 作成は誰でも（created_by=本人）。更新/削除は owner or admin。
drop policy if exists events_admin_write on public.events;
drop policy if exists events_insert on public.events;
drop policy if exists events_modify on public.events;
drop policy if exists events_delete on public.events;

create policy events_insert on public.events
  for insert with check (created_by = auth.uid());

create policy events_modify on public.events
  for update using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

create policy events_delete on public.events
  for delete using (created_by = auth.uid() or public.is_admin());

-- event_participants: 参加者管理は owner or admin（本人のharshness更新は既存policyのまま）。
drop policy if exists event_participants_admin_write on public.event_participants;
drop policy if exists event_participants_manage on public.event_participants;
create policy event_participants_manage on public.event_participants
  for all using (public.is_admin() or public.is_event_owner(event_id))
  with check (public.is_admin() or public.is_event_owner(event_id));

-- evaluations 削除: 評価者本人 / admin / イベントオーナー（テストデータ掃除用）。
drop policy if exists evaluations_delete on public.evaluations;
create policy evaluations_delete on public.evaluations
  for delete using (
    evaluator_id = auth.uid()
    or public.is_admin()
    or public.is_event_owner(event_id)
  );
