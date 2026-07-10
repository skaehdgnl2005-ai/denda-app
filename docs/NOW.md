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

- **✅ Wave 0~2 승인 스코프 종료 (2026-07-10 세션5)**. 후속 진입점: W2-8 잔여 sweep(선택, 아래) 또는 Wave 3(Gate #2 통과 후). 이력: 착수 `2026-07-10-ui-polish-wave2-completion-kickoff.md`, 기술 `2026-07-10-ui-polish-wave2-handoff.md`(§6 세션5 종료 기록), Wave 1 `2026-07-09-ui-polish-wave1-handoff.md`.
- **상태**: **Wave 0 ✅ DONE + Wave 1 여정 3모먼트 ✅ DONE (2026-07-08~09, ship)**. 플랜 승인(스코프 Wave 0~2), 결정 4건: R1=①Lucide 합성 FAB / R2=①벨 제거 / W1-14=풀 구현(front+삭제 RPC) / overlay 토큰 승인.
- **SSoT**: `docs/superpowers/specs/2026-07-08-ui-polish-design.md` (+ audit findings). 계통 원인 C1(프리미티브 부재)·C2(상태=시스템 Alert 15파일)·C3(모션·reduce-motion 0) 근본 해결.
- **Wave 0 ✅ 완료·ship** (28ffaaa): 프리미티브 6종(Button·Toast·ConfirmSheet·EmptyState·ScreenHeader·Spinner) + useReducedMotion·easing 헬퍼 + overlay 토큰 + messages.ts. 전부 TDD. 다중 에이전트 리뷰 11건 확정→전부 수정.
- **Wave 1 진행 중** — ✅ **여정 3모먼트 완료·ship** (가장 중요 P0, Gate #1·#2 클라이맥스):
  - W1-2 장소 확정(place-search·midpoint): Alert 확인 → ConfirmSheet + error Toast (78a5c05)
  - W1-3 "예약하기"(place): Alert → success Toast + loading/error 프리미티브 (78a5c05)
  - W1-1 모임 확정(group index): Alert 5곳 제거 → ConfirmedTimeCard 등장 모먼트(emphasized) + Toast, 로드에러 EmptyState (384dc77)
- **세션 2 (2026-07-09) 완료·ship — 10 커밋** (상세: handoff 문서 §0.5):
  - ✅ **W1-14 회원 탈퇴 풀 구현**(Edge delete_account service_role+JWT 도출+Google revoke+2단 ConfirmSheet+로컬 teardown, @reviewer×2 반영) — a9c4f78·4806335
  - ✅ **W1-4/5/8/10/15** friends index(cda84cf)·requests(1de1d77)·search+useKakaoInvite(f84b86a)·login/new/_layout(8d07509)·InviteCodeModal(785e1dd)·invite(c214a8b)
  - ✅ **W1-11/12** 스플래시·privacy(1554ec0) · **W1-7** 홈 fetch 위장 해제+refetch+RefreshControl+벨 제거(23f3b27)
  - ✅ housekeeping config.toml PG 15→17(원격=17 확인)+deno.lock ignore (af13d98)
- **Wave 1 ✅ 완료·ship (2026-07-09 세션3 — +5 커밋)**:
  - ✅ **W1-6 everytime** (9b96492): Alert 6→0 (인라인 힌트·error Toast·설정 이동 ConfirmSheet·OCR Skeleton·Spinner)
  - ✅ **W1-13 약관 전문** (d1a35b3): terms chevron→별도 44pt Pressable + `legal.tsx` 신규(이용약관/마케팅, privacy Section 재사용) — 법적 P0 해소
  - ✅ **W1-9 지도 탭** (1eddd99): 죽은 카드→읽기전용 상세 ConfirmSheet+카톡 공유(그룹없음, Gate #2 무접촉) + 첫로드 Skeleton + 에러 재시도·결과보존 + EmptyState + clear/returnKey + `useMapSearch.retry()`
  - ✅ **Wave 1 종료 게이트** (2a7377d): /design-check + 4렌즈 adversarial 리뷰(Workflow, 토큰·a11y·API·다크모드 — 6 raised→**4 confirmed 수정**→2 정당 rejected) + 에뮬 실기 렌더(legal L/D·terms L, redbox 0)
- **Wave 2 🟡 13/15 진행·ship (2026-07-10 세션4 — +8 커밋, `1a103bd`~`adac285`)**: W2-4 ScreenHeader 10화면 / W2-1·2·3 셸(탭바 safe area·중앙 FAB GroupFab·다크 네비) / W2-6·7a Cell 히트맵 모션·a11y(D12 worklet diff 0) / W2-5·7b 요일 헤더·RealtimeStatus·ConfirmedTimeCard·focus refetch / W2-13 SearchField / W2-9·11·12·14·15 화면 마감 5종(병렬) / W2-10 친구(부분). 종료 게이트: 4렌즈 리뷰 confirmed 4건 수정(`adac285`).
- **✅ Wave 2 완결·ship (2026-07-10 세션5 — +3 커밋 `61a5c8f`·`2ed4282`·`4eaa3ac`)**: **W2-10** requests·search(in-flight 잠금·pull-refresh·빈 CTA·FriendRequestCard pending) · **PlaceActionSheet** 시트 모션 rework(slide→자체 medium+enter/exit·reduce-motion, D12 무접촉) · **W2-8** `src/design/press.ts` 헬퍼(rowPressBg/ctaPressBg) 신설 + 초기 sweep 8파일(양 버킷). 전부 TDD. 종료 게이트: full green + 자체 4렌즈 리뷰(Workflow는 spend limit로 불가). **승인 스코프(Wave 0~2) 종료.**
- **✅ W2-8 잔여 sweep도 완료 (2026-07-10 세션5 +1 커밋 `51d372d`)**: 잔여 12 화면/컴포넌트(terms·map·group[id]/index·midpoint·invite·requests·search·InviteCodeModal·ConfirmSlotSheet·FirstTimeModal·OriginInput·MapPlaceholder) opacity→press 헬퍼 전면 채택(서브에이전트 5 Sonnet 병렬 후 중앙 재검증). **의도적 제외(후속 아님)**: Cell(D12)·아이콘 전용 버튼(opacity)·ghost brand pill(brand-50 base)·캘린더 날짜셀(stateful)·stateful 선택 행·profile SettingRow(구조 변경 필요)·Gate #2 PlaceActionSheet CTA. → **W2-8 사실상 종결.**
- **패턴 확립**: Alert→Toast(useToast, 성공/안내) · Alert 확인→ConfirmSheet · raw e.message→mapError · 에러 위장→EmptyState error variant · 로딩→Spinner/Skeleton. 스크린 테스트는 SafeAreaProvider+ThemeProvider+ToastProvider 래퍼 필요.
- **불가침**: D12 worklet diff 0 · Phase 3 코드 0 · DESIGN 토큰 외 시각 결정 0 · Gate #1·#2 로깅 1회성 불변.
- **상태**: Jest **1198 pass / 1 skip** / tsc 0 / eslint 0 / design-guard clean / Deno 에지 8/8. branch `feat/map-maphost-m0` **push 완료**(origin 추적, 세션5 +5 커밋 `61a5c8f`·`2ed4282`·`4eaa3ac`·docs·`51d372d`). 로컬 deno=`/c/Users/skaeh/.deno/bin/deno.exe`(PATH 밖).
- **마지막 update**: 2026-07-10 (세션 5 — Wave 2 완결 15/15, W2-8 잔여 sweep은 후속)

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
