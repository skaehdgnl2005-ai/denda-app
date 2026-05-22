# 된다 (DenDa) — 프로젝트 이해 (압축)

> AI 세션 시작 시 필수 읽기. 제품·페르소나·게이트·금지선·결정을 1번 스캔으로 파악.
> deep dive는 하단 §9 참조 인덱스로.

## §1. 1분 요약

- 제품 한 줄: 친구와 시간·장소·예약 한 번에. 소셜 스케줄링+예약 모바일 앱.
- 현재 phase: **Phase 1+2 활성** (Sprint 0). "예약하기" 클릭 로깅만.
- 잠금: 🔒 **Phase 3** (토스 결제, reservations/payments/payouts, F6/F7 푸시).
- 최우선 게이트: **Gate #2 ≥ 25%** (장소 확정 → "예약하기" 클릭).
- 베타 타깃: P1 대학생 + P2 직장인 (서울 강남/홍대/건대).

## §2. 페르소나 (WHO)

- **P1 ★ 베타 핵심**: 20대 전반 대학생. 3-6명 1-2주 모임. 에브리타임 OCR. 야간/주말 비중↑.
- **P2**: 20대 후반-30대 직장인. 회식·동호회 호스트. Google/네이버 캘린더.
- **P3**: 게스트 비회원. 카톡 링크 일회성. 웹 fallback → 자체 deferred deep link 앱 전환 + 4자리 코드 fallback ([D28](DECISIONS.md#d28--자체-deferred-deep-link-구축-attribution-saas-회피-도메인-구매-회피)).

## §3. 정보 구조 + P0 기능 (WHAT)

4탭 + FAB: **홈 | 친구 | [+] FAB(모임 만들기) | 지도 | 프로필**

P0 (v1.0 필수, Phase 1+2):
- 카카오 OAuth ([D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede) OIDC + Supabase signInWithIdToken)
- 시간 그리드 15분 슬롯 + 드래그 멀티셀렉트 (60fps)
- 모임 → 시간 투표 → 확정 → 장소 flow
- 네이버 지도 + 카카오 Local API (반경·카테고리·제휴 마커)
- **"예약하기" 클릭 로깅** (Gate #2 측정 — 실제 결제 X)
- 캘린더 동기화 Google + Apple iOS 단방향
- 푸시 F1-F5 (소셜 3 + 모임 2). F6/F7 = Phase 3
- 다크모드 시스템 자동 (수동 토글 = P1)
- 에브리타임 OCR (Gemini Vision)
- "지도로 내 일정 보기" 모드

P1 (v1.1+): 네이버 캘린더 / 다크 수동 / 호스트 위임 / 식당 셀프 가입+어드민 / 자동 노쇼 / 카페 BM / Promoted listing
폐기: Memories(추억) / 외부 예약 API 직결(캐치테이블 등)

## §4. 비즈니스 모델 (WHY)

- 시장 위치: 캘린더 앱 아님. "함께할 시간 + 함께할 장소 + 예약" 이원축.
- BM (Phase 3): **호스트 예약금 20,000원 고정**. 우리 7.5% (1,500원/건). 식당 92.5%.
- 정상·노쇼 무관 수수료. 토스페이먼츠 분할정산(서브머천트).
- 환불: 24h+ 전 100% / 1-24h 50% / 1h 이내·노쇼 0%.

## §5. 출시 전략 + 게이트 (WHEN)

Phase 1+2 (현재, ~3.5주 timeline):
- 클라: RN/Expo + Kakao OAuth + 시간 그리드 + 지도/검색 + 클릭 로깅 + 캘린더 + 푸시 F1-F5 + 다크 자동 + OCR
- 백엔드: 새 Supabase project + partnerships table만
- 비포함: 토스 위젯 / 통신판매업 / 변호사 약관 / 실제 예약·정산 / F6-F7

Decomposed Gate (W2-W8 측정):

| 게이트 | 측정 | ≥강신호 | 중간 | <약신호 → 액션 |
|---|---|---|---|---|
| #1 | 모임 확정 → 장소 확정 | ≥40% | 20-39% (UX +2w) | <20% 가설 무너짐 |
| **#2 ★** | 장소 확정 → 클릭 | **≥25% Phase 3 commit** | 10-24% segment 분리 | <10% 3-path 재결정 |

Gate #2 통과 시 Phase 3 진입 6단계:
1. 토스페이먼츠 가맹 심사 (1-2w)
2. 통신판매업 신고 (5-7영업일)
3. 변호사 약관 검토 (1-2w)
4. 사업자 계좌 + 정산 인프라
5. 식당 20곳 활성화 → 첫 결제 trigger
6. 푸시 F6/F7 활성

## §6. 절대 금지 (Phase boundary)

🔒 Phase 3 코드 작성 금지 (Gate #2 ≥ 25% 통과 전):

- 토스페이먼츠 SDK import / 위젯 코드
- `reservations` / `payments` / `payouts` 테이블 schema·migration
- `groups.reservation_id` column
- 푸시 F6 (예약 확정 알림) / F7 (정산 알림)
- 실제 환불 flow / 노쇼 자동 판정 / 사업자 정산 dashboard
- 식당 어드민·셀프 가입 UI (P1으로 이연)
- Memories(추억) / 캐치테이블 직결 (폐기)

위반 시 → 사용자 즉시 확인. PROGRESS.md Gate KPI 진척 없으면 작성 보류.
**자동 차단**: `.claude/hooks/design-guard.sh`가 토스페이먼츠·reservations/payments/payouts·groups.reservation_id·F6/F7·캐치테이블 import/참조를 grep으로 차단 (exit 2).

## §7. Cardinal 결정 — AI가 모르면 잘못 짤 10가지

- **D11** Realtime 히트맵 = Edge Function 합산 후 broadcast (클라 raw votes 합산 금지)
- **D12** 60fps 시간 그리드 = Reanimated worklet UI thread (setState per touch 금지)
- **D13** KST 강제 — DB는 TIMESTAMPTZ(UTC), client는 luxon Asia/Seoul. `new Date()` 직접 금지
- **D14** 15분 슬롯 = DB CHECK `start_minute % 15 = 0`. 30분 데이터는 UI 깨짐
- **D16** 차단/신고 = `is_blocked()` helper + RLS. 모든 SELECT 통과
- **D17** Push F4 idempotency = `groups.f4_sent_at` UPDATE WHERE IS NULL
- **D18** 좌표는 WGS84 정규화. `lib/coords/normalize.ts` 단일 진입점
- **D20** Calendar push fan-out = pg_cron background queue (호스트 액션 즉시 응답)
- **D22** Phase 1+2 Tech Stack 확정 — 토스/Stripe/Firebase 추가 금지
- **D25** Cold start <2초 — 지도·캘린더·OCR·Branch는 lazy import

(전체 D1-D26 + G1·G2: [DECISIONS.md](DECISIONS.md))

## §8. 시스템 한 장

Tech Stack (Phase 1+2):
- 모바일: RN + Expo SDK 53+ / zustand / expo-secure-store / Reanimated worklet
- 지도/검색: @mj-studio/react-native-naver-map + Kakao Local API
- 캘린더: expo-calendar (iOS 17+ write-only) + Google Calendar API
- 푸시: expo-notifications / OCR: Gemini Vision / Attribution: 자체 deferred deep link ([D28](DECISIONS.md#d28--자체-deferred-deep-link-구축-attribution-saas-회피-도메인-구매-회피)) — Vercel subdomain + fingerprint + 4자리 코드 fallback
- 백엔드: Supabase (Postgres + Realtime + Edge + Auth + Storage)
- 웹 게스트: Next.js + Vercel (별도 codebase)
- 🔒 Phase 3 deferred: 토스 / 통신판매업 / 변호사 약관 / 식당 인프라

주요 테이블 (Phase 1+2):
- `users` (kakao_id, email — nullable, Phase 3 비즈앱 후 채움)
- `groups` (host_id, confirmed_at, **f4_sent_at**)
- `votes` (group_id, **start_minute CHECK %15=0**)
- `places` (kakao_place_id, **lat/lng WGS84**, partnership_id?)
- `partnerships` (place_id, status — read-only)
- `schedules` (user_id, **source enum**, start_at UTC, recurrence_rule)
- `blocks` (blocker_id, blocked_id)
- 🔒 Phase 3 추가: reservations + payments + payouts + groups.reservation_id

## §9. 더 깊이 보려면 (참조 인덱스)

| 궁금한 것 | 보러 가기 |
|---|---|
| 화면별 세부 spec | [PRD.md](PRD.md) §5 (화면별 기능 명세) |
| 도메인 모델 전체 | [PRD.md](PRD.md) §6 + [ARCHITECTURE.md](ARCHITECTURE.md) §3 |
| 외부 연동 상세 | [PRD.md](PRD.md) §7 (Kakao/Naver/Google/Gemini/Branch) |
| Phase 3 결제 상세 | [PRD.md](PRD.md) §8 (🔒 잠금) |
| 푸시 F1-F7 | [PRD.md](PRD.md) §9 |
| 비기능 (성능·a11y·보안) | [PRD.md](PRD.md) §15 |
| Open Questions Q-A~Q-D | [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) |
| 시각 토큰 전체 | [DESIGN.md](DESIGN.md) |
| Edge Function 패턴 | [ARCHITECTURE.md](ARCHITECTURE.md) §4 + supabase/functions |
| 테스트 47 path | [TEST_PLAN.md](TEST_PLAN.md) |
| 결정 D1-D26 전체 맥락 | [DECISIONS.md](DECISIONS.md) |
| 현재 진행 중 (active) | [NOW.md](NOW.md) (활성 작업 라이브 상태판, ≤50줄) |
| 현재 sprint 진척 | [PROGRESS.md](PROGRESS.md) + [TASK_BACKLOG.md](TASK_BACKLOG.md) |
