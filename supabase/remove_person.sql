<<<<<<< HEAD
-- 배정이 끝난 뒤 한 명을 명단에서 빼기: SQL Editor에 통째로 붙여넣고 한 번 실행
-- 뺄 사람의 마니또가 그 사람의 마니띠를 이어받아 원을 다시 잇습니다.
-- 나머지 사람의 배정·코드·쪽지·프로필·힌트는 그대로이고, 이어받는 두 사람의 쪽지함만 새로 시작합니다.
-- 중간에 실패하면 전부 취소되고, 이미 빠진 뒤에 다시 실행해도 아무 일도 일어나지 않습니다.

do $$
declare
  gone int := 11; -- 이정빈
  sec admin_secret;
  giver int;
  receiver int;
begin
  select * into strict sec from admin_secret where id = 1;
  receiver := (sec.assignment->>gone::text)::int;
  select e.key::int into giver from jsonb_each_text(sec.assignment) e where e.value::int = gone;

  if giver is not null and receiver is not null then
    if giver = receiver or (sec.assignment->>receiver::text)::int = giver then
      raise exception '이으면 본인 배정이나 쌍방이 생겨요. 관리자 페이지에서 다시 배정해 주세요.';
    end if;

    -- 마니또의 쪽지함을 비워서 새 마니띠에게 연결
    delete from chat_items where thread_id = sec.threads->>giver::text;
    update chats set receiver_id = receiver where thread_id = sec.threads->>giver::text;
    update login_keys set receiver_id = receiver where person_id = giver;

    update admin_secret
       set assignment = jsonb_set(assignment, array[giver::text], to_jsonb(receiver))
     where id = 1;
  end if;

  update admin_secret
     set codes = codes - gone::text,
         assignment = assignment - gone::text,
         threads = threads - gone::text
   where id = 1;

  delete from hint_draws where drawer_id = gone or owner_id = gone;
  delete from hints where person_id = gone;
  delete from profiles where id = gone;
  delete from chats where thread_id = sec.threads->>gone::text; -- 쪽지도 같이 지워짐
  delete from chats where receiver_id = gone;
  delete from login_keys where person_id = gone;
  delete from people where id = gone;
end $$;

-- ✅ 확인용: 네 숫자가 모두 28이면 성공 (코드 발급 전이면 코드 수는 0)
select (select count(*) from people) as people,
       (select count(*) from jsonb_object_keys(assignment)) as assignment,
       (select count(*) from jsonb_object_keys(codes)) as codes,
       (select count(*) from login_keys) as login_keys
  from admin_secret where id = 1;
=======
-- 참가자 한 명 빼기: SQL Editor에서 이름만 바꿔 실행한 뒤, 관리자 화면을 새로고침하고 "배정 실행"을 다시 누르세요.
-- 그 사람의 코드·프로필·힌트·쪽지만 지우고, 나머지 사람의 코드는 그대로 둡니다 (재배정 때 기존 코드를 다시 씀).
do $$
declare
  target int := (select id from people where name = '이정빈');
  k text := target::text;
begin
  if target is null then raise exception '명단에 없는 이름이에요'; end if;

  delete from hint_draws where drawer_id = target or owner_id = target;
  delete from hints where person_id = target;
  delete from profiles where id = target;
  -- 그 사람이 받는 쪽지함 + 그 사람이 보내는 쪽지함 (쪽지도 같이 지워짐)
  delete from chats where receiver_id = target
     or thread_id in (select thread_id from login_keys where person_id = target);
  -- 그 사람을 챙기던 마니또는 재배정 전까지 잠시 마니띠 없음
  update login_keys set receiver_id = null, thread_id = null where receiver_id = target;
  delete from login_keys where person_id = target;
  update admin_secret
     set codes = codes - k, assignment = assignment - k, threads = threads - k
   where id = 1;
  delete from people where id = target;
end $$;

select count(*) as people_left from people;
>>>>>>> 879ea906d7050a55c88398a630fd9fc2959a6b26
