-- 0014_votes_unique_index.sql
-- Fail #10: votes (group_id, user_id|guest_token, day, start_minute) 중복 row 방지.
--
-- 배경:
--   - S05c::commitVoteDiff는 INSERT/DELETE diff 기반 (best-effort atomicity, Notes line 922)
--   - 더블 commit 또는 race 시 동일 slot에 중복 row INSERT 가능 (SESSION_LOG S05c line 924)
--   - 클라 보수 책임이었으나 운영 안전망으로 DB CHECK 격상 (Phase 1+2 safety net)
--
-- 동작:
--   - user_id NOT NULL: (group_id, user_id, day, start_minute) unique
--   - guest_token NOT NULL: (group_id, guest_token, day, start_minute) unique
--   - 두 컬럼 중 정확히 하나만 NOT NULL (0001:300 CHECK)이라 partial index 안전
--   - INSERT 충돌 시 PostgreSQL이 unique_violation throw → 클라가 catch 후 silent skip 또는 retry

CREATE UNIQUE INDEX IF NOT EXISTS votes_user_unique_idx
  ON public.votes(group_id, user_id, day, start_minute)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS votes_guest_unique_idx
  ON public.votes(group_id, guest_token, day, start_minute)
  WHERE guest_token IS NOT NULL;
