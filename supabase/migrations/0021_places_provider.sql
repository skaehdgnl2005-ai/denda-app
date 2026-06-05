-- ============================================================================
-- 된다 (DenDa) — S20: places 멀티 provider 영속화 보강
-- 출처: docs/superpowers/specs/2026-05-28-journey-spine-roadmap-design.md (S20 §9)
--       /start-task S20 spec 진입 closure (2026-05-28):
--         "places 영속화 = migration 보강 (kakao_place_id nullable + source/provider_place_id)"
--
-- 배경: 0001의 places.kakao_place_id 는 NOT NULL UNIQUE 라 카카오 전용 가정.
--   S16 NaverSearchProvider 결과는 안정 ID 미제공 → name+좌표 합성 providerPlaceId + source='naver'.
--   카카오 가정 컬럼으로는 네이버 장소를 정직하게 영속화할 수 없다.
--
-- 변경:
--   1. kakao_place_id 를 nullable 로 (네이버 행은 NULL — 카카오 unblock 시 백필 가능)
--   2. source / provider_place_id 컬럼 추가 (provider 무관 공통 식별)
--   3. (source, provider_place_id) UNIQUE → 같은 식당 dedup (upsert onConflict 대상)
--
-- 기존 행 백필: source='kakao' (DEFAULT) + provider_place_id = kakao_place_id.
--   베타 시점 places 행은 사실상 0건 (S10 네이티브 맵 미랜딩)이라 백필 영향 미미.
-- ============================================================================

-- 1. 카카오 전용 NOT NULL 제약 해제 (네이버 행은 kakao_place_id NULL)
ALTER TABLE public.places ALTER COLUMN kakao_place_id DROP NOT NULL;

-- 2. provider 식별 컬럼 추가
ALTER TABLE public.places
  ADD COLUMN source TEXT NOT NULL DEFAULT 'kakao' CHECK (source IN ('kakao', 'naver'));
ALTER TABLE public.places
  ADD COLUMN provider_place_id TEXT;

-- 3. 기존 행 백필 (source 는 DEFAULT 'kakao' 자동, provider_place_id 만 채움)
UPDATE public.places
  SET provider_place_id = kakao_place_id
  WHERE provider_place_id IS NULL;

-- 4. 백필 후 NOT NULL 승격 (이후 모든 INSERT 는 provider_place_id 필수)
ALTER TABLE public.places ALTER COLUMN provider_place_id SET NOT NULL;

-- 5. dedup UNIQUE — upsert onConflict='source,provider_place_id' 대상.
--    같은 네이버 식당을 여러 모임이 골라도 places 행 1개로 수렴.
CREATE UNIQUE INDEX places_source_provider_idx
  ON public.places(source, provider_place_id);

COMMENT ON COLUMN public.places.source IS 'S20: 장소 출처 (kakao | naver). dedup·provider 분기용.';
COMMENT ON COLUMN public.places.provider_place_id IS 'S20: provider 고유/합성 ID. (source, provider_place_id) UNIQUE.';
