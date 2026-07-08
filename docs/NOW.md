# Now — 현재 진행 중

> 활성 작업의 라이브 상태판. 중단/재개 시 컨텍스트 복원 단일 위치.
>
> **규칙**:
> - 항목 추가: `/start-task`가 처리 (skill §3.5)
> - 항목 삭제: `/ship-task`가 promote 시 처리 (skill §2.5)
> - 50줄 hard limit. 초과 시 `/ship-task`가 정리 권유 알림.
> - 누적 history는 [SESSION_LOG](SESSION_LOG.md). 여기는 **활성 상태만**.

---

## 🟢 활성 작업

### UI Polish (Lane F, Wave 0~2) — 출시 전 완성도 전면 개선

- **상태**: **Wave 0 ✅ DONE (2026-07-08, ship)**. 플랜 승인(스코프 Wave 0~2), 결정 4건: R1=①Lucide 합성 FAB / R2=①벨 제거 / W1-14=풀 구현(front+삭제 RPC) / overlay 토큰 승인.
- **SSoT**: `docs/superpowers/specs/2026-07-08-ui-polish-design.md` (+ audit findings). 계통 원인 C1(프리미티브 부재)·C2(상태=시스템 Alert 15파일)·C3(모션·reduce-motion 0) 근본 해결.
- **Wave 0 ✅ 완료·ship** (28ffaaa): 프리미티브 6종(Button·Toast·ConfirmSheet·EmptyState·ScreenHeader·Spinner) + useReducedMotion·easing 헬퍼 + overlay 토큰 + messages.ts. 전부 TDD. 다중 에이전트 리뷰 11건 확정→전부 수정.
- **Wave 1 진행 중** — ✅ **여정 3모먼트 완료·ship** (가장 중요 P0, Gate #1·#2 클라이맥스):
  - W1-2 장소 확정(place-search·midpoint): Alert 확인 → ConfirmSheet + error Toast (78a5c05)
  - W1-3 "예약하기"(place): Alert → success Toast + loading/error 프리미티브 (78a5c05)
  - W1-1 모임 확정(group index): Alert 5곳 제거 → ConfirmedTimeCard 등장 모먼트(emphasized) + Toast, 로드에러 EmptyState (384dc77)
- **Wave 1 잔여 (다음 세션)**:
  - W1-4~6 Alert 나머지 →0: friends/index·requests·search(~20곳), everytime(6), _layout 자동합류, InviteCodeModal, login, new.tsx, invite
  - W1-7~9 상태 디자인: 홈(fetch 실패 위장+useFocusEffect refetch+RefreshControl), 친구(위장+Skeleton), 지도(죽은 카드 Pressable화+Skeleton)
  - W1-11~13 스플래시 다크 flash, privacy 뒤로 화살표, 약관 전문 화면
  - **W1-14 회원 탈퇴 풀 구현** (프론트 2단 ConfirmSheet + Supabase 삭제 RPC/Edge — 백엔드 포함, @reviewer 강화)
  - W1-15 검색 카톡초대 no-op → useKakaoInvite
  - 이후 **Wave 2** (셸·그리드 시각·화면 마감, FAB=Lucide 합성, 벨 제거)
- **패턴 확립**: Alert→Toast(useToast, 성공/안내) · Alert 확인→ConfirmSheet · raw e.message→mapError · 에러 위장→EmptyState error variant · 로딩→Spinner/Skeleton. 스크린 테스트는 SafeAreaProvider+ThemeProvider+ToastProvider 래퍼 필요.
- **불가침**: D12 worklet diff 0 · Phase 3 코드 0 · DESIGN 토큰 외 시각 결정 0 · Gate #1·#2 로깅 1회성 불변.
- **⚠️ 미결**: `supabase/config.toml` PG 15→17 무관 변경 커밋 제외 유지(사용자 결정 대기).
- **상태**: Jest **1067 pass** / tsc 0 / eslint 0. branch `feat/map-maphost-m0` (미push).
- **마지막 update**: 2026-07-08

### S16 Phase b — KakaoLocalProvider (Q-A2 허용 → D37)

- **상태**: 코드 빌드 완료 (TDD green) · **미ship** · 운영 prereq 대기
- **배경**: 카카오 "허용" 답변 수신(2026-06-01, [D37](DECISIONS.md#d37--q-a2-카카오-local-api-약관-허용-답변-수신--kakaolocalprovider-평가-트랙)). NaverSearchProvider(D36)와 같은 `PlaceSearchProvider` 인터페이스로 추가 → 데이터 quality 비교 후 우위 시 primary 교체.
- **완료 (TDD, 44 tests green)**:
  - `supabase/functions/_lib/kakao_local.ts` (+`_test.ts` 23✓) — 좌표(WGS84 decimal)·카테고리(group 우선)·파싱·fetch
  - `supabase/functions/kakao_local_search/index.ts` (+`_test.ts` 13✓) — Edge proxy, `KAKAO_REST_API_KEY` Edge env (rule 7)
  - `src/lib/places/KakaoLocalProvider.ts` (+`.test.ts` 8✓) — invoke 클라이언트 (NaverSearchProvider 미러)
  - typecheck 0 / eslint 0 / Naver 회귀 0
- **🟦 결론 ([D39](DECISIONS.md#d39--장소-검색-primary--naversearchprovider-확정-kakao-local-보류-카카오맵-심사-반려), 2026-06-08)**: 카카오맵 `OPEN_MAP_AND_LOCAL` 제품 심사 **반려** + 출시 우선 → **NaverSearchProvider primary 확정**. 카카오맵 심사 재도전 안 함. Kakao 평가 트랙 보류.
- **출시 prereq (1개)**: `supabase functions deploy naver_local_search` (현재 미배포 — 배포 즉시 앱 장소 검색 동작. NAVER_CLIENT_ID/SECRET 등록·검증 완료).
- **Kakao 자산 dormant**: KakaoLocalProvider·kakao_local·kakao_local_search (TDD green 보존, 미사용 — 추후 카카오맵 승인 시 provider 주입 교체로 무비용 재활성).
- **미ship**: `/ship-task` 미실행 (SESSION_LOG·PROGRESS·TASK_BACKLOG promote 대기)
- **⚠️ 본 빌드와 무관한 기존 실패**: `tests/screens/schedule/map.test.tsx` 2건(S15 async point 렌더) — import 커플링 0, 별도 조사 대상 (2026-06-08 확인: 현재 6/6 green, 해소됨)

### S-MAP — 지도 렌더 활성화(MapHost) + 4대 확장 — 코딩 트랙 완료 (운영 트랙만 잔여)

- **상태**: **M0+①·M2·M3·M4 전부 DONE** (2026-06-09). 4대 확장 시각·로직 레이어 완성 → SESSION_LOG promote 완료. 별도 feat 브랜치 `feat/map-maphost-m0` (미push/미PR).
- **운영 트랙만 잔여 (사용자/운영, 코드 변경 0 점등)**:
  - 네이버 Maps Client ID 발급 → `.env` `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID` + `EXPO_PUBLIC_MAP_ENABLED=true` → `expo prebuild && expo run:android` → 네이티브 마커·폴리라인·중간점·제휴 강조 실렌더 + 60fps
  - `supabase functions deploy naver_local_search` (라이브 장소 검색)
  - 제휴 마커 PNG 1.5x/2x/3x 에셋(Q-B13, 디자인) → 제휴 inner stroke 점등
  - ② 제휴 **실데이터**는 Phase 3(D3, Gate #2 ≥25% 통과 후) — 현재 `isResultPartner` stub
- 설계 SSoT: `docs/superpowers/specs/2026-06-08-map-feature-activation-design.md` · [D38](DECISIONS.md#d38--지도-렌더-seam--maphost-단일-경계--mapscene-계약--ismapavailable-env-게이트)
