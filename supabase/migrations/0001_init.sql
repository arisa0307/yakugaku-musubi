-- ============================================================================
-- 薬学むすび 模擬面接 相互評価アプリ  初期マイグレーション
-- テーブル / RLS / SECURITY DEFINER RPC / 共通 seed を1ファイルで投入する。
--
-- 設計上の最重要点:
--  1. 評価を受ける側は「自分あての集計」だけ見られる。
--     → evaluations 等のベーステーブルに evaluatee は直接 SELECT できない。
--        受け手は get_my_feedback RPC 経由でのみ集計を取得する。
--  2. 評価者の匿名性。RPC は evaluator_id を一切返さない（列レベルで遮断）。
--  3. 自由記述は任意。NULL / 空文字でも送信できる。
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- テーブル
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role         text not null default 'student' check (role in ('student', 'admin')),
  created_at   timestamptz not null default now()
);

create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  scheduled_at timestamptz,
  status       text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.event_participants (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.events (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  group_no           int,
  requested_harshness text not null default 'chukara'
    check (requested_harshness in ('amakuchi', 'chukara', 'karakuchi')),
  created_at         timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists idx_event_participants_event on public.event_participants (event_id);
create index if not exists idx_event_participants_user on public.event_participants (user_id);

-- 評価基準。ハードコード禁止・DBで編集可能。event_id null = 共通デフォルト。
create table if not exists public.rubric_items (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid references public.events (id) on delete cascade,
  sort_order  int not null default 0,
  label       text not null,
  description text,
  min_score   int not null default 1,
  max_score   int not null default 5,
  anchors     jsonb,
  created_at  timestamptz not null default now()
);

-- 選択式コメントのマスタ。min_harshness 以上の強度で表示する。
create table if not exists public.comment_options (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid references public.events (id) on delete cascade,
  kind          text not null check (kind in ('good', 'improve')),
  text          text not null,
  sort_order    int not null default 0,
  min_harshness text not null default 'amakuchi'
    check (min_harshness in ('amakuchi', 'chukara', 'karakuchi')),
  created_at    timestamptz not null default now()
);

create table if not exists public.evaluations (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.events (id) on delete cascade,
  evaluator_id       uuid not null references auth.users (id) on delete cascade,
  evaluatee_id       uuid not null references auth.users (id) on delete cascade,
  free_note          text,
  top_improvement_id uuid not null references public.comment_options (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (event_id, evaluator_id, evaluatee_id),
  check (evaluator_id <> evaluatee_id)  -- 自己評価の禁止（集計が歪むため）
);

create index if not exists idx_evaluations_event_evaluatee on public.evaluations (event_id, evaluatee_id);
create index if not exists idx_evaluations_event_evaluator on public.evaluations (event_id, evaluator_id);

create table if not exists public.evaluation_scores (
  id             uuid primary key default gen_random_uuid(),
  evaluation_id  uuid not null references public.evaluations (id) on delete cascade,
  rubric_item_id uuid not null references public.rubric_items (id),
  score          int not null check (score between 1 and 5),
  unique (evaluation_id, rubric_item_id)
);

create index if not exists idx_evaluation_scores_eval on public.evaluation_scores (evaluation_id);

create table if not exists public.evaluation_comments (
  id                uuid primary key default gen_random_uuid(),
  evaluation_id     uuid not null references public.evaluations (id) on delete cascade,
  comment_option_id uuid not null references public.comment_options (id),
  unique (evaluation_id, comment_option_id)
);

create index if not exists idx_evaluation_comments_eval on public.evaluation_comments (evaluation_id);

-- ----------------------------------------------------------------------------
-- ヘルパー関数（RLS の再帰を避けるため SECURITY DEFINER）
-- ----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- 指定ユーザーがそのイベントの参加者か。u 省略時は現在のユーザー。
create or replace function public.is_event_participant(e uuid, u uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.event_participants ep
    where ep.event_id = e and ep.user_id = u
  );
$$;

-- 現在のユーザーと other が、少なくとも1つ同じイベントに参加しているか。
-- （相手の表示名を見せてよいか＝「誰を評価するか」の一覧表示に必要。
--   評価者の匿名性はこれとは別に evaluations の RLS で担保している。）
create or replace function public.shares_event(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.event_participants a
    join public.event_participants b on a.event_id = b.event_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- ----------------------------------------------------------------------------
-- 新規ユーザー → profiles 自動作成
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at 自動更新
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_evaluations_touch on public.evaluations;
create trigger trg_evaluations_touch
  before update on public.evaluations
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

alter table public.profiles            enable row level security;
alter table public.events              enable row level security;
alter table public.event_participants  enable row level security;
alter table public.rubric_items        enable row level security;
alter table public.comment_options     enable row level security;
alter table public.evaluations         enable row level security;
alter table public.evaluation_scores   enable row level security;
alter table public.evaluation_comments enable row level security;

-- profiles: 本人の read/update。admin は全 read。
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid() or public.is_admin() or public.shares_event(id)
  );

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- events: 参加者 / 作成者 / admin が read。書き込みは admin のみ。
drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select using (
    public.is_event_participant(id) or created_by = auth.uid() or public.is_admin()
  );

drop policy if exists events_admin_write on public.events;
create policy events_admin_write on public.events
  for all using (public.is_admin()) with check (public.is_admin());

-- event_participants: 同じイベントの参加者同士は read 可（グループ一覧のため）。
-- requested_harshness は本人が自分の行を update できる。書き込み（追加/割当）は admin。
drop policy if exists event_participants_select on public.event_participants;
create policy event_participants_select on public.event_participants
  for select using (
    user_id = auth.uid() or public.is_event_participant(event_id) or public.is_admin()
  );

drop policy if exists event_participants_self_update on public.event_participants;
create policy event_participants_self_update on public.event_participants
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists event_participants_admin_write on public.event_participants;
create policy event_participants_admin_write on public.event_participants
  for all using (public.is_admin()) with check (public.is_admin());

-- rubric_items: 共通(null) かそのイベント参加者が read。書き込みは admin。
drop policy if exists rubric_items_select on public.rubric_items;
create policy rubric_items_select on public.rubric_items
  for select using (
    event_id is null or public.is_event_participant(event_id) or public.is_admin()
  );

drop policy if exists rubric_items_admin_write on public.rubric_items;
create policy rubric_items_admin_write on public.rubric_items
  for all using (public.is_admin()) with check (public.is_admin());

-- comment_options: 同上。
drop policy if exists comment_options_select on public.comment_options;
create policy comment_options_select on public.comment_options
  for select using (
    event_id is null or public.is_event_participant(event_id) or public.is_admin()
  );

drop policy if exists comment_options_admin_write on public.comment_options;
create policy comment_options_admin_write on public.comment_options
  for all using (public.is_admin()) with check (public.is_admin());

-- evaluations: 評価者本人と admin のみ SELECT（evaluatee は直接読めない = 匿名性の要）。
-- INSERT/UPDATE は本人かつそのイベント参加者。evaluatee もイベント参加者であること。
drop policy if exists evaluations_select on public.evaluations;
create policy evaluations_select on public.evaluations
  for select using (evaluator_id = auth.uid() or public.is_admin());

drop policy if exists evaluations_insert on public.evaluations;
create policy evaluations_insert on public.evaluations
  for insert with check (
    evaluator_id = auth.uid()
    and evaluator_id <> evaluatee_id
    and public.is_event_participant(event_id, auth.uid())
    and public.is_event_participant(event_id, evaluatee_id)
  );

drop policy if exists evaluations_update on public.evaluations;
create policy evaluations_update on public.evaluations
  for update using (evaluator_id = auth.uid()) with check (evaluator_id = auth.uid());

drop policy if exists evaluations_delete on public.evaluations;
create policy evaluations_delete on public.evaluations
  for delete using (evaluator_id = auth.uid() or public.is_admin());

-- evaluation_scores: 親 evaluation の所有者(評価者) か admin。
drop policy if exists evaluation_scores_select on public.evaluation_scores;
create policy evaluation_scores_select on public.evaluation_scores
  for select using (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_id and (e.evaluator_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists evaluation_scores_write on public.evaluation_scores;
create policy evaluation_scores_write on public.evaluation_scores
  for all using (
    exists (select 1 from public.evaluations e
            where e.id = evaluation_id and e.evaluator_id = auth.uid())
  ) with check (
    exists (select 1 from public.evaluations e
            where e.id = evaluation_id and e.evaluator_id = auth.uid())
  );

-- evaluation_comments: 同上。
drop policy if exists evaluation_comments_select on public.evaluation_comments;
create policy evaluation_comments_select on public.evaluation_comments
  for select using (
    exists (
      select 1 from public.evaluations e
      where e.id = evaluation_id and (e.evaluator_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists evaluation_comments_write on public.evaluation_comments;
create policy evaluation_comments_write on public.evaluation_comments
  for all using (
    exists (select 1 from public.evaluations e
            where e.id = evaluation_id and e.evaluator_id = auth.uid())
  ) with check (
    exists (select 1 from public.evaluations e
            where e.id = evaluation_id and e.evaluator_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- RPC: get_my_feedback(target_event_id)  … 受け手が自分あての集計を取得
--   evaluator_id は一切含めない。自由記述は2件以上のときだけ返す。
-- ----------------------------------------------------------------------------

create or replace function public.get_my_feedback(target_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  eval_count int;
  result jsonb;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  -- 自分あての評価件数（評価者の人数）
  select count(*) into eval_count
  from public.evaluations e
  where e.event_id = target_event_id and e.evaluatee_id = me;

  result := jsonb_build_object(
    'event_id', target_event_id,
    'evaluation_count', eval_count,

    -- rubric ごとの平均(小数1桁)/最小/最大/件数
    'rubric', coalesce((
      select jsonb_agg(r order by r.sort_order, r.label)
      from (
        select
          ri.id          as rubric_item_id,
          ri.label       as label,
          ri.description as description,
          ri.sort_order  as sort_order,
          round(avg(s.score)::numeric, 1) as avg,
          min(s.score)   as min,
          max(s.score)   as max,
          count(s.score) as count
        from public.evaluation_scores s
        join public.evaluations e on e.id = s.evaluation_id
        join public.rubric_items ri on ri.id = s.rubric_item_id
        where e.event_id = target_event_id and e.evaluatee_id = me
        group by ri.id, ri.label, ri.description, ri.sort_order
      ) r
    ), '[]'::jsonb),

    -- 選択式コメント集計（kind別・降順）
    'comments', jsonb_build_object(
      'good', coalesce((
        select jsonb_agg(c order by c.count desc, c.text)
        from (
          select co.id as comment_option_id, co.text as text, count(*) as count
          from public.evaluation_comments ec
          join public.evaluations e on e.id = ec.evaluation_id
          join public.comment_options co on co.id = ec.comment_option_id
          where e.event_id = target_event_id and e.evaluatee_id = me and co.kind = 'good'
          group by co.id, co.text
        ) c
      ), '[]'::jsonb),
      'improve', coalesce((
        select jsonb_agg(c order by c.count desc, c.text)
        from (
          select co.id as comment_option_id, co.text as text, count(*) as count
          from public.evaluation_comments ec
          join public.evaluations e on e.id = ec.evaluation_id
          join public.comment_options co on co.id = ec.comment_option_id
          where e.event_id = target_event_id and e.evaluatee_id = me and co.kind = 'improve'
          group by co.id, co.text
        ) c
      ), '[]'::jsonb)
    ),

    -- 「最優先の改善点」集計
    'top_improvement', coalesce((
      select jsonb_agg(t order by t.count desc, t.text)
      from (
        select co.id as comment_option_id, co.text as text, count(*) as count
        from public.evaluations e
        join public.comment_options co on co.id = e.top_improvement_id
        where e.event_id = target_event_id and e.evaluatee_id = me
        group by co.id, co.text
      ) t
    ), '[]'::jsonb),

    -- 自由記述。2件以上あるときだけ返す（1件だと発信者が特定されやすい）。発信者情報なし。
    'free_notes', (
      select case when count(*) >= 2
        then coalesce(jsonb_agg(note order by random()), '[]'::jsonb)
        else '[]'::jsonb end
      from (
        select e.free_note as note
        from public.evaluations e
        where e.event_id = target_event_id
          and e.evaluatee_id = me
          and e.free_note is not null
          and btrim(e.free_note) <> ''
      ) notes
    )
  );

  return result;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: get_my_history()  … 項目別スコアの推移（P2）
--   rubric は id ではなく label で束ねる（回によって改訂されうるため）。
-- ----------------------------------------------------------------------------

create or replace function public.get_my_history()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  return coalesce((
    select jsonb_agg(ev order by ev.scheduled_at nulls last, ev.title)
    from (
      select
        e.id as event_id,
        e.title as title,
        e.scheduled_at as scheduled_at,
        coalesce((
          select jsonb_agg(it order by it.label)
          from (
            select ri.label as label,
                   round(avg(s.score)::numeric, 1) as avg,
                   count(s.score) as count
            from public.evaluations ev2
            join public.evaluation_scores s on s.evaluation_id = ev2.id
            join public.rubric_items ri on ri.id = s.rubric_item_id
            where ev2.event_id = e.id and ev2.evaluatee_id = me
            group by ri.label
          ) it
        ), '[]'::jsonb) as items
      from public.events e
      where exists (
        select 1 from public.evaluations ev3
        where ev3.event_id = e.id and ev3.evaluatee_id = me
      )
    ) ev
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_my_feedback(uuid) to authenticated;
grant execute on function public.get_my_history() to authenticated;

-- ----------------------------------------------------------------------------
-- seed: 共通デフォルト rubric_items（event_id null）
-- ----------------------------------------------------------------------------

insert into public.rubric_items (event_id, sort_order, label, description, min_score, max_score, anchors)
values
(null, 1, '質問理解・論理構成', '聞かれたことに、伝わる形で答えているか', 1, 5, jsonb_build_object(
  '1', '聞かれたことと違う話をしている。質問の意図を取り違えている',
  '2', '質問には沿っているが、準備した回答を話すことが優先されている',
  '3', '聞かれたことに答えているが、話の順序が整理されておらず要点が伝わりにくい',
  '4', '質問の意図を捉え、要点から先に述べられている',
  '5', '質問の意図を正確に捉え、要点と理由が結びついた形で簡潔に答えられている')),
(null, 2, '動機の深さ・自己理解', 'なぜそう考えるのかを自分の言葉で語れるか', 1, 5, jsonb_build_object(
  '1', '「患者に寄り添いたい」等の言葉のみで、理由が語られない',
  '2', '理由は述べるが、一般論で誰にでも当てはまる内容',
  '3', '自分の経験を挙げているが、その経験と動機の繋がりが説明されていない',
  '4', '経験と動機が繋がっている。その経験をどう受け止めたかの説明は浅い',
  '5', '自分の経験と、そこで何を感じ考えたかが動機に結びつき、その人にしか言えない内容になっている')),
(null, 3, '自己PR・経験の具体性', '何をして、何を考えた人かが伝わるか', 1, 5, jsonb_build_object(
  '1', '「頑張った」等の抽象語のみ。何をしたか分からない',
  '2', 'エピソードはあるが主語が"みんな"で、自分の行動が見えない',
  '3', '経験の説明は詳しいが、自分が何を考えどう動いたかが弱い',
  '4', '自分の考えと行動を語れている。結果や学びの説明がやや弱い',
  '5', '状況→自分の考え・行動→結果を具体的に説明でき、数字や事実などの客観的な裏づけもある')),
(null, 4, '深掘り対応力・一貫性', '掘られた先に実体があるか', 1, 5, jsonb_build_object(
  '1', '「なぜ？」に答えられず詰まる',
  '2', '答えるが、最初の回答の言い換えに留まり中身が増えない',
  '3', '掘られると答えるが、最初の回答と食い違う部分が出る',
  '4', '掘られても矛盾なく答えられる。回答に新しい具体は多くない',
  '5', '掘るほど具体的な事実や当時の考えが出てきて、話全体が一貫している')),
(null, 5, 'オンライン印象', '非言語で損をしていないか', 1, 5, jsonb_build_object(
  '1', '目線が下がったまま。声が不明瞭で聞き取りづらい',
  '2', '聞き取れるが、原稿を読んでいる印象が強い',
  '3', '概ね聞き取れるが、表情が硬く一本調子',
  '4', 'カメラ目線・明瞭な発声ができている。やや緊張が残る',
  '5', 'カメラ目線・明瞭・適度な間と表情で、対面に近い印象を与える'))
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- seed: 共通デフォルト comment_options（event_id null）
-- ----------------------------------------------------------------------------

-- good（min_harshness = amakuchi：全モードで表示）
insert into public.comment_options (event_id, kind, text, sort_order, min_harshness)
select null, 'good', t, row_number() over (), 'amakuchi'
from unnest(array[
  '質問の意図を正しく捉えていた',
  '要点から話せていた',
  'なぜそう行動したかが説明できていた',
  '自分の言葉で話していた',
  '経験と動機が繋がっていた',
  '自分の考えと行動が明確だった',
  'エピソードに事実の裏づけがあった',
  '掘られても具体的に答えられていた',
  '回答に一貫性があった',
  'カメラ目線で話せていた',
  '声が明瞭で聞き取りやすかった',
  '表情が柔らかく好印象だった'
]) as t
on conflict do nothing;

-- improve（min_harshness = chukara：中辛以上で表示）
insert into public.comment_options (event_id, kind, text, sort_order, min_harshness)
select null, 'improve', t, 100 + row_number() over (), 'chukara'
from unnest(array[
  '聞かれたことと違う話をしている',
  '質問に答えるより、準備した回答を話すことが優先されている',
  '話の順序が整理されておらず要点が伝わりにくい',
  '動機が一般論に留まる',
  '経験と動機が繋がっていない',
  '経験の説明が中心で、自分の考えが見えない',
  '行動は語れているが「なぜそうしたか」が分からない',
  '主語が"みんな"で自分の行動が見えない',
  '結果・学びが語られていない',
  '掘られると中身が増えない',
  '回答同士に一貫性がない',
  '早口で聞き取りづらい',
  '視線が下がり印象が弱い',
  '原稿を読んでいる印象が強い',
  '表情が硬い'
]) as t
on conflict do nothing;

-- improve（min_harshness = karakuchi：辛口でのみ表示）
insert into public.comment_options (event_id, kind, text, sort_order, min_harshness)
select null, 'improve', t, 200 + row_number() over (), 'karakuchi'
from unnest(array[
  '質問の意図を取り違えている',
  '動機が借り物の言葉で自分が見えない',
  '経験の説明に終始し本人の思考が見えない',
  '掘られると最初の回答と食い違う',
  '準備した内容以外に対応できていない'
]) as t
on conflict do nothing;
