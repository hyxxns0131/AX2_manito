-- 힌트 뽑기 추가분: 이미 schema.sql을 실행한 프로젝트의 SQL Editor에 붙여넣고 한 번 실행
-- 기존 배정·코드·쪽지·프로필은 그대로 유지됩니다.

-- 자기 힌트 3개. 뽑기 전에는 누구도 읽을 수 없음
create table hints (
  person_id int not null references people(id),
  slot int not null check (slot between 1 and 3),
  text text not null check (char_length(text) between 1 and 100),
  primary key (person_id, slot)
);

-- 마니또(drawer)가 마니띠(owner)의 어떤 힌트를 뽑았는지
create table hint_draws (
  drawer_id int not null references people(id),
  owner_id int not null references people(id),
  slot int not null,
  drawn_at bigint not null,
  primary key (drawer_id, owner_id, slot)
);

alter table hints enable row level security;
alter table hint_draws enable row level security;

-- 힌트를 뽑을 대상(내 마니띠). 마니띠 확인 시작 전에는 null
create function hint_target(p_key text) returns int
language sql stable security definer set search_path = public as $$
  select receiver_id from login_keys where key = p_key and is_revealed();
$$;

-- 내가 쓴 힌트 3칸 (빈칸은 '')
create function get_own_hints(p_key text) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  me int := key_owner(p_key);
begin
  if me is null then raise exception '다시 로그인해 주세요.'; end if;
  return (
    select json_agg(coalesce(h.text, '') order by s.slot)
    from generate_series(1, 3) as s(slot)
    left join hints h on h.person_id = me and h.slot = s.slot
  );
end $$;

-- 본인 힌트만 저장 가능, 빈칸은 지움
create function save_hints(p_key text, p_hints text[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  me int := key_owner(p_key);
  v text;
begin
  if me is null then raise exception '다시 로그인해 주세요.'; end if;
  for i in 1..3 loop
    v := left(btrim(coalesce(p_hints[i], '')), 100);
    if v = '' then
      delete from hints where person_id = me and slot = i;
    else
      insert into hints (person_id, slot, text) values (me, i, v)
      on conflict (person_id, slot) do update set text = excluded.text;
    end if;
  end loop;
end $$;

-- 내 마니띠의 힌트 개수와 내가 이미 뽑은 힌트 (안 뽑은 힌트의 내용은 내려주지 않음)
create function get_hint_game(p_key text) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  me int := key_owner(p_key);
  target int := hint_target(p_key);
begin
  if me is null then raise exception '다시 로그인해 주세요.'; end if;
  return json_build_object(
    'total', (select count(*) from hints where person_id = target),
    'drawn', coalesce((
      select json_agg(h.text order by d.drawn_at, d.slot)
      from hint_draws d
      join hints h on h.person_id = d.owner_id and h.slot = d.slot
      where d.drawer_id = me and d.owner_id = target
    ), '[]'::json)
  );
end $$;

-- 아직 안 뽑은 힌트 중 하나를 서버에서 무작위로 고름. 남은 게 없으면 null
create function draw_hint(p_key text) returns json
language plpgsql security definer set search_path = public as $$
declare
  me int := key_owner(p_key);
  target int := hint_target(p_key);
  picked record;
begin
  if me is null or target is null then raise exception '아직 뽑을 수 없어요.'; end if;
  select h.slot, h.text into picked
    from hints h
   where h.person_id = target
     and not exists (select 1 from hint_draws d
                      where d.drawer_id = me and d.owner_id = target and d.slot = h.slot)
   order by random()
   limit 1;
  if not found then return null; end if;
  insert into hint_draws (drawer_id, owner_id, slot, drawn_at)
  values (me, target, picked.slot, now_ms())
  on conflict do nothing;
  return json_build_object('text', picked.text);
end $$;

-- 코드·배정 저장 + 로그인 키 다시 만들기 (p_reset_chats면 쪽지함도 새로)
create or replace function admin_commit(p_password text, p_codes jsonb, p_assignment jsonb, p_threads jsonb,
                             p_keys jsonb, p_reset_chats boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform check_admin(p_password);

  update admin_secret
     set codes = p_codes, assignment = p_assignment, threads = p_threads
   where id = 1;

  if p_reset_chats then
    delete from chats where true;   -- 쪽지(chat_items)도 같이 지워짐
    delete from hint_draws where true; -- 새 마니띠의 힌트를 처음부터 뽑도록
    insert into chats (thread_id, receiver_id)
    select t.value, (p_assignment->>t.key)::int
      from jsonb_each_text(p_threads) t;
  end if;

  delete from login_keys where true;
  insert into login_keys (key, person_id, receiver_id, thread_id)
  select e.key, (e.value->>'id')::int, (e.value->>'receiverId')::int, e.value->>'threadId'
    from jsonb_each(p_keys) e;
end $$;

-- 새 함수는 기본 공개라 내부용을 막고 필요한 것만 허용
revoke execute on function hint_target(text), get_own_hints(text), save_hints(text, text[]), get_hint_game(text), draw_hint(text) from public, anon, authenticated;
grant execute on function get_own_hints(text), save_hints(text, text[]), get_hint_game(text), draw_hint(text) to anon, authenticated;
