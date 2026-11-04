-- 참가자 한 명 빼기: SQL Editor에서 이름만 바꿔 실행한 뒤, 관리자 화면을 새로고침하고 "배정 실행"을 다시 누르세요.
-- 그 사람의 코드·프로필·힌트·쪽지만 지우고, 나머지 사람의 코드는 그대로 둡니다 (재배정 때 기존 코드를 다시 씀).
-- 이미 빠진 뒤에 다시 실행하면 '명단에 없는 이름이에요'만 나오고 아무것도 바뀌지 않습니다.
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
  -- 배정표에서 그 사람이 주는 쪽·받는 쪽 둘 다 지움
  update admin_secret
     set codes = codes - k,
         threads = threads - k,
         assignment = coalesce((select jsonb_object_agg(e.key, e.value)
                                  from jsonb_each(assignment) e
                                 where e.key <> k and e.value <> to_jsonb(target)), '{}')
   where id = 1;
  delete from people where id = target;
end $$;

select count(*) as people_left from people;
