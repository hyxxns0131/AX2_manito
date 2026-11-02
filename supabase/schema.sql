-- 마니또 Supabase 스키마: SQL Editor에 통째로 붙여넣고 한 번 실행
-- 모든 테이블은 RLS로 막아두고, 아래 함수(security definer)로만 읽고 씁니다.
-- 실행 후 관리자 비밀번호를 꼭 바꾸세요 (맨 아래 참고).

create extension if not exists pgcrypto with schema extensions;

/* ───────────── 테이블 ───────────── */

create table people (
  id int primary key,
  name text not null,
  gender text not null default '' check (gender in ('', 'M', 'F'))
);

-- { mode, customPct, revealAt, finalRevealAt, drawnAt }
create table settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'
);

-- 로그인 키 = SHA-256("id:코드"). 코드를 아는 본인만 자기 행을 찾을 수 있음
create table login_keys (
  key text primary key,
  person_id int not null references people(id),
  receiver_id int references people(id),
  thread_id text
);

create table profiles (
  id int primary key references people(id),
  likes text not null default '',
  dislikes text not null default '',
  allergy boolean not null default false,
  updated_at bigint
);

-- 쪽지함 id는 무작위라 받는 사람 쪽에선 보낸 사람이 드러나지 않음
create table chats (
  thread_id text primary key,
  receiver_id int not null references people(id)
);

create table chat_items (
  id bigserial primary key,
  thread_id text not null references chats(thread_id) on delete cascade,
  sender text not null check (sender in ('giver', 'receiver')),
  text text not null check (char_length(text) between 1 and 200),
  at bigint not null
);
create index on chat_items (thread_id, at);

-- 관리자 비밀번호(bcrypt) + 코드·전체 배정 원본
create table admin_secret (
  id int primary key default 1 check (id = 1),
  password_hash text not null,
  codes jsonb not null default '{}',
  assignment jsonb not null default '{}',
  threads jsonb not null default '{}'
);

alter table people enable row level security;
alter table settings enable row level security;
alter table login_keys enable row level security;
alter table profiles enable row level security;
alter table chats enable row level security;
alter table chat_items enable row level security;
alter table admin_secret enable row level security;

/* ───────────── 초기 데이터 ───────────── */

-- js/participants.js 와 같은 id
insert into people (id, name) values
  (1, '김도훈'), (2, '맹민지'), (3, '강현서'), (4, '권해원'), (5, '김민정'),
  (6, '김민'), (7, '박진혁'), (8, '권혁주'), (9, '김민서'), (10, '유정현'),
  (11, '이정빈'), (12, '장희주'), (13, '소준희'), (14, '문승호'), (15, '정은진'),
  (16, '최가은'), (17, '정주연'), (18, '양효선'), (19, '이상협'), (20, '한윤수'),
  (21, '황주현'), (22, '주상준'), (23, '이나원'), (24, '이수연'), (25, '홍은주'),
  (26, '황준영'), (27, '최유진'), (28, '이현경'), (29, '채주현');

insert into settings (id) values (1);
insert into admin_secret (id, password_hash)
  values (1, extensions.crypt('CHANGE_ME', extensions.gen_salt('bf')));

/* ───────────── 내부 도우미 ───────────── */

create function now_ms() returns bigint
language sql stable as $$
  select (extract(epoch from now()) * 1000)::bigint;
$$;

-- 기본 비밀번호(CHANGE_ME)로는 절대 들어갈 수 없음
create function check_admin(p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_password is null or p_password = 'CHANGE_ME' or not exists (
    select 1 from admin_secret where id = 1 and password_hash = crypt(p_password, password_hash)
  ) then
    raise exception '비밀번호가 올바르지 않습니다.';
  end if;
end $$;

-- 마니띠 확인 시작 시각이 지났는지 (설정 안 했으면 바로 공개)
create function is_revealed() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (data->>'revealAt')::timestamptz <= now() from settings where id = 1), true);
$$;

create function key_owner(p_key text) returns int
language sql stable security definer set search_path = public as $$
  select person_id from login_keys where key = p_key;
$$;

-- 이 쪽지함에서 내 역할: 'giver'(내가 챙겨주는 쪽) / 'receiver'(챙김 받는 쪽) / null(권한 없음)
create function thread_role(p_key text, p_thread text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when not is_revealed() then null
    when exists (select 1 from login_keys where key = p_key and thread_id = p_thread) then 'giver'
    when exists (select 1 from chats c join login_keys k on k.person_id = c.receiver_id
                  where k.key = p_key and c.thread_id = p_thread) then 'receiver'
  end;
$$;

/* ───────────── 참가자용 ───────────── */

create function get_people() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', id, 'name', name, 'gender', gender) order by id), '[]')
  from people;
$$;

create function get_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select data from settings where id = 1), '{}');
$$;

-- 마니띠 확인 시작 전에는 배정 정보를 내려주지 않음
create function find_key(p_key text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', person_id,
    'receiverId', case when is_revealed() then receiver_id end,
    'threadId', case when is_revealed() then thread_id end)
  from login_keys where key = p_key;
$$;

create function get_profile(p_id int) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('likes', likes, 'dislikes', dislikes, 'allergy', allergy, 'updatedAt', updated_at)
  from profiles where id = p_id;
$$;

-- 본인 프로필만 저장 가능
create function save_profile(p_key text, p_likes text, p_dislikes text, p_allergy boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  me int := key_owner(p_key);
begin
  if me is null then raise exception '다시 로그인해 주세요.'; end if;
  insert into profiles (id, likes, dislikes, allergy, updated_at)
  values (me, left(coalesce(p_likes, ''), 100), left(coalesce(p_dislikes, ''), 100),
          coalesce(p_allergy, false), now_ms())
  on conflict (id) do update
    set likes = excluded.likes, dislikes = excluded.dislikes,
        allergy = excluded.allergy, updated_at = excluded.updated_at;
end $$;

-- 나를 챙겨주는 마니또와의 쪽지함
create function find_thread_for(p_key text) returns text
language sql stable security definer set search_path = public as $$
  select c.thread_id from chats c join login_keys k on k.person_id = c.receiver_id
   where k.key = p_key and is_revealed()
   limit 1;
$$;

create function get_chat(p_key text, p_thread text) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('from', sender, 'text', text, 'at', at) order by at, id), '[]')
  from chat_items
  where thread_id = p_thread and thread_role(p_key, p_thread) is not null;
$$;

-- 보낸 사람 역할은 서버가 정함
create function send_chat(p_key text, p_thread text, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare
  role text := thread_role(p_key, p_thread);
  body text := left(trim(coalesce(p_text, '')), 200);
begin
  if role is null then raise exception '쪽지함을 찾을 수 없어요.'; end if;
  if body = '' then return; end if;
  insert into chat_items (thread_id, sender, text, at) values (p_thread, role, body, now_ms());
end $$;

-- 정체 공개 시각 이후에만 전체 배정을 내려줌
create function get_final_reveal() returns jsonb
language sql stable security definer set search_path = public as $$
  select a.assignment from admin_secret a, settings s
   where a.id = 1 and s.id = 1 and (s.data->>'finalRevealAt')::bigint <= now_ms();
$$;

/* ───────────── 관리자용 (매번 비밀번호 확인) ───────────── */

create function admin_login(p_password text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform check_admin(p_password);
end $$;

create function admin_load_secret(p_password text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform check_admin(p_password);
  return (select json_build_object('codes', codes, 'assignment', assignment, 'threads', threads)
            from admin_secret where id = 1);
end $$;

create function admin_save_people(p_password text, p_people jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform check_admin(p_password);
  insert into people (id, name, gender)
  select x.id, x.name, coalesce(x.gender, '')
    from jsonb_to_recordset(p_people) as x(id int, name text, gender text)
  on conflict (id) do update set name = excluded.name, gender = excluded.gender;
end $$;

create function admin_save_settings(p_password text, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform check_admin(p_password);
  insert into settings (id, data) values (1, p_patch)
  on conflict (id) do update set data = settings.data || excluded.data;
end $$;

-- 코드·배정 저장 + 로그인 키 다시 만들기 (p_reset_chats면 쪽지함도 새로)
create function admin_commit(p_password text, p_codes jsonb, p_assignment jsonb, p_threads jsonb,
                             p_keys jsonb, p_reset_chats boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform check_admin(p_password);

  update admin_secret
     set codes = p_codes, assignment = p_assignment, threads = p_threads
   where id = 1;

  if p_reset_chats then
    delete from chats where true;   -- 쪽지(chat_items)도 같이 지워짐
    insert into chats (thread_id, receiver_id)
    select t.value, (p_assignment->>t.key)::int
      from jsonb_each_text(p_threads) t;
  end if;

  delete from login_keys where true;
  insert into login_keys (key, person_id, receiver_id, thread_id)
  select e.key, (e.value->>'id')::int, (e.value->>'receiverId')::int, e.value->>'threadId'
    from jsonb_each(p_keys) e;
end $$;

/* ───────────── 권한 ───────────── */

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  get_people(), get_settings(), find_key(text), get_profile(int),
  save_profile(text, text, text, boolean), find_thread_for(text),
  get_chat(text, text), send_chat(text, text, text), get_final_reveal(),
  admin_login(text), admin_load_secret(text), admin_save_people(text, jsonb),
  admin_save_settings(text, jsonb),
  admin_commit(text, jsonb, jsonb, jsonb, jsonb, boolean)
  to anon, authenticated;

-- ⚠️ 실행 후 관리자 비밀번호를 바꾸세요 (바꾸기 전에는 관리자 화면에 못 들어가요):
--   update admin_secret set password_hash = extensions.crypt('원하는비밀번호', extensions.gen_salt('bf')) where id = 1;
