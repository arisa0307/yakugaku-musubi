-- ============================================================================
-- イベント参加コード（自己参加登録）
--   運営がメールを集めて手動割当しなくてよいように、イベントごとの参加コードを追加。
--   参加者はログイン済み（本人ID）のまま、コードを入力して自分をイベントに登録する。
--   → 匿名性・自分あて集計の仕組みは一切変えない（本人IDが保たれるため）。
-- ============================================================================

alter table public.events add column if not exists join_code text;

-- 大文字小文字を区別せず一意に
create unique index if not exists idx_events_join_code
  on public.events (upper(join_code));

-- コードを入力して現在のユーザーを参加登録する RPC。
-- 「参加者追加は admin のみ」という RLS を、正しいコードのとき本人1件だけ許可する形。
create or replace function public.join_event_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  ev_id uuid;
  ev_title text;
  ev_status text;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  if p_code is null or btrim(p_code) = '' then
    return jsonb_build_object('ok', false, 'error', 'コードを入力してください');
  end if;

  select id, title, status into ev_id, ev_title, ev_status
  from public.events
  where upper(join_code) = upper(btrim(p_code))
  limit 1;

  if ev_id is null then
    return jsonb_build_object('ok', false, 'error', 'コードが見つかりません');
  end if;

  if ev_status = 'closed' then
    return jsonb_build_object('ok', false, 'error', 'このイベントは終了しています');
  end if;

  insert into public.event_participants (event_id, user_id)
  values (ev_id, me)
  on conflict (event_id, user_id) do nothing;

  return jsonb_build_object('ok', true, 'event_id', ev_id, 'title', ev_title);
end;
$$;

grant execute on function public.join_event_by_code(text) to authenticated;
