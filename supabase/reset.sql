-- 테스트 후 초기화: 배정·코드·쪽지·프로필·설정을 지움 (명단·성별·관리자 비밀번호는 유지)
delete from chats where true;        -- 쪽지도 같이 지워짐
delete from login_keys where true;
delete from profiles where true;
update admin_secret set codes = '{}', assignment = '{}', threads = '{}' where id = 1;
update settings set data = '{}' where id = 1;
