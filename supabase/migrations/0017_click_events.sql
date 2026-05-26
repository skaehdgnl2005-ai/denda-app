-- ============================================================================
-- 된다 (DenDa) — Migration 0017: S08 "예약하기" Click-through 측정 (Gate #2 single source of truth)
-- 출처: docs/TASK_BACKLOG.md S08, docs/DECISIONS.md G2 (장소 확정 → 예약하기 click ≥25% Phase 3 commit)
--
-- 책임:
--   1. click_events table — 마커 바텀시트의 "예약하기" 버튼 click event 기록
--   2. event_id PRIMARY KEY = 클라이언트가 UUID 생성 → ON CONFLICT DO NOTHING으로
--      더블 탭/네트워크 재시도 idempotency 보장 (acceptance "더블 탭 1 event")
--   3. RLS: 본인 row SELECT/INSERT만. service_role(분석 dashboard)은 RLS bypass
--
-- Schema:
--   event_id        UUID PRIMARY KEY        — 클라 발급 (Idempotency-Key pattern)
--   user_id         UUID NOT NULL FK users  — segment 분리 측정 base
--   group_id        UUID NOT NULL FK groups — Gate #1 → #2 funnel context
--   place_id        UUID NOT NULL FK places — click 대상 장소
--   partnership_id  UUID nullable FK partnerships — 제휴 여부 snapshot (places.partnership_id가 click 후 변경되어도 보존)
--   segment_label   TEXT nullable           — 'P1'/'P2' (Q-A4 closure 시 채움. CHECK enum)
--   clicked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()  — 클라 시점 (네트워크 지연 무시)
--   created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()  — 서버 수신 시점
--
-- Q-A4 deferred: segment_label은 nullable. Q-A4 closure 후 P1/P2 식별 규칙 적용 시
--   채워서 INSERT. baseline 수집 phase는 NULL 허용.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. click_events table
-- ============================================================================

CREATE TABLE public.click_events (
  event_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  partnership_id UUID REFERENCES public.partnerships(id) ON DELETE SET NULL,
  segment_label TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (segment_label IS NULL OR segment_label IN ('P1', 'P2'))
);

-- ============================================================================
-- 2. Indexes
-- ============================================================================

-- Gate #2 핫패스: 모임 × 장소 단위 unique click 집계 (장소 확정 vs click 비율)
CREATE INDEX click_events_group_place_idx
  ON public.click_events(group_id, place_id);

-- 시계열 분석 — daily Gate #2 burn-down
CREATE INDEX click_events_clicked_at_idx
  ON public.click_events(clicked_at DESC);

-- place 단위 분석 — 제휴 식당 마커 popular rank
CREATE INDEX click_events_place_clicked_idx
  ON public.click_events(place_id, clicked_at DESC);

-- segment 분리 (Q-A4 closure 후 활용)
CREATE INDEX click_events_segment_idx
  ON public.click_events(segment_label, clicked_at DESC)
  WHERE segment_label IS NOT NULL;

-- 사용자별 click history (본인 조회 RLS 쿼리)
CREATE INDEX click_events_user_idx
  ON public.click_events(user_id, clicked_at DESC);

-- 제휴 click 핫패스 (제휴 식당 ROI 측정)
CREATE INDEX click_events_partnership_idx
  ON public.click_events(partnership_id, clicked_at DESC)
  WHERE partnership_id IS NOT NULL;

-- ============================================================================
-- 3. RLS — 본인 row 조회·INSERT. service_role bypass (분석 dashboard).
-- ============================================================================

ALTER TABLE public.click_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY click_events_select_own
  ON public.click_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY click_events_insert_self
  ON public.click_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE/DELETE 정책 없음 = immutable analytics event (사용자도 본인 click 수정·삭제 불가)
-- service_role만 운영 cleanup 가능

COMMENT ON TABLE public.click_events IS
  'S08 (Gate #2): "예약하기" 버튼 click event. event_id PK = 클라 idempotency. segment_label = Q-A4 closure 시 채움.';
COMMENT ON COLUMN public.click_events.event_id IS
  'Client-provided UUID — ON CONFLICT DO NOTHING으로 더블 탭/재시도 idempotency 보장.';
COMMENT ON COLUMN public.click_events.partnership_id IS
  'Snapshot of places.partnership_id at click time. 추후 places.partnership_id 변경되어도 history 보존.';
COMMENT ON COLUMN public.click_events.segment_label IS
  'P1(학생) / P2(직장인) / NULL(미식별). Q-A4 closure 후 식별 규칙 적용.';

COMMIT;
