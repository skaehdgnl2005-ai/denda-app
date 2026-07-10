# UI 폴리시 플랜 실행 — Wave 3 (P2 디테일) 착수 인수인계 2026-07-10 (세션6용)

> 다음 세션 시작 시 이 문서 하나 + "먼저 읽을 것"만 읽으면 바로 이어서 작업 가능.
> Wave 3 스펙 본문은 `2026-07-08-ui-polish-design.md` §6 (W3-1~6), 이 문서는 착수 순서·현황·운영팁.

---

## 상황

- 앱 전 화면 UI 폴리시 플랜(Wave 0~2 승인) **전량 완료·ship·push**. Wave 2 완결 = 세션5(브랜치 `feat/map-maphost-m0`, `61a5c8f`~`e03e7b4`).
- 이번 세션 = **Wave 3 (P2 디테일, ~1.5일)**. 스펙 §6: W3-1 타입 스케일 / W3-2 간격 리터럴 / W3-3 터치 타깃·tabular-nums / W3-4 다크 개별 보정 / W3-5 모션 마감 / W3-6 지도 마커·MapHost 정합.
- ⚠️ **Wave 3는 원래 "시간 허용 시" P2** (승인 스코프는 Wave 0~2였음, design §9 리스크 표). 이 핸드오프 자체가 착수 신호지만, **출시 블로커인 운영 트랙**(아래)이 P2 폴리시보다 값어치 높을 수 있음 → 착수 전 사용자와 **우선순위 한 줄 확인** 권장.
  - 대안(운영 트랙, NOW.md): `supabase functions deploy naver_local_search`(장소 검색 점등) · 네이버 Map Client ID + `EXPO_PUBLIC_MAP_ENABLED=true`(지도 실렌더) · S13 실기 cold-start(iOS·full number) · **S17 QA 종합 + 안암 invite-only launch** · 제휴 마커 PNG 에셋.
- 전체 green: **Jest 1198 pass / 1 skip · tsc 0 · eslint 0 · design-guard clean · D12 회귀 가드 green.**

## 먼저 읽을 것 (CLAUDE.md 공통 5개 외)

1. `docs/superpowers/specs/2026-07-08-ui-polish-design.md` **§6**(W3-1~6 본문) · §7(검증 계획) · §8(스코프 제외) — 스펙 SSoT.
2. `docs/superpowers/specs/2026-07-10-ui-polish-wave2-handoff.md` §2(확립 패턴)·§6(세션5 종료·press 헬퍼·Sonnet sweep 교훈) — 이어서 기계 적용할 패턴.
3. UI 작업 → `docs/DESIGN.md` §5(타이포)·§6(모션)·§10.5(마커)·§12(다크·a11y) + `.claude/rules/design.md` 자동 로드.
4. `docs/NOW.md`(운영 트랙 잔여) · `docs/SESSION_LOG.md` 최근(UI-W2b DONE).

## ⚠️ 착수 전 현황 재확인 (step 0 — 필수)

Wave 3 항목 일부가 **Wave 1/2에서 선반영**됨. 착수 전 grep으로 잔여만 골라낸다:
- **W3-4 ConfirmedTimeCard 다크** → **이미 완료(W2-7, surface-2)**. skip.
- **W3-3 친구 요청 버튼** → 세션5에서 FriendRequestCard(`actionButton` height 44)·search(`send-request-button` minHeight 36) 손댐 → 실제 미달 여부 재측정.
- **W3-6 MapHost** → S-MAP M0에서 이미 도입(`src/components/map/MapHost.tsx`). "구조 통일"은 신규 도입 아니라 **정합 확인**만.
- **W3-2 간격/W3-1 타입** → 화면 마감(W2-9·11·12·14·15)에서 일부 토큰화됨. grep로 잔여 임의값만.
- **press 딤 sweep(W2-8)** → `src/design/press.ts`(rowPressBg/ctaPressBg) 확립·전 화면 채택 완료. W3에서 새 press 사이트 나오면 재사용(신규 opacity 딤 만들지 말 것).

## 착수 순서 (권장 — 기계적→판단 순, 상세는 design §6)

0. **baseline**: `npm test` green(1198) 확인 + 위 현황 grep.
1. **W3-2 간격 리터럴 sweep** (기계적·최대량): `marginTop: 2/4`·`paddingVertical: 5/6` 등 임의 숫자 → `space[N]` 토큰(4pt 그리드). 프로필·지도·캘린더 weekdayHead 등. → **Sonnet 서브에이전트 병렬 적합**(아래 팁).
2. **W3-1 타입 스케일** (기계적): 온보딩 26pt→typography display 토큰, 임의 `lineHeight`/`letterSpacing` 오버라이드 제거(auth 5곳·홈 5곳). typography 토큰 계약 TDD.
3. **W3-3 터치 타깃·tabular-nums** (작음): 홈 '지도로 보기'(schedule-map-entry 34pt)·친구 요청 버튼(36pt) → `hitSlop` 44pt. 멤버 수 카운터 `fontVariant: ['tabular-nums']` 누락 보정.
4. **W3-4 다크 개별 보정** (화면별): 홈 CTA rgba 흰색 하드코딩→`text['on-brand']` 토큰 / privacy 테이블 헤더 surface-2 / 로그인 히트램프 heat-0 비가시→border-subtle hairline / NaverMapScene 캡션 halo(가독성). **두 모드 동등 검증**(contrast).
5. **W3-5 모션 마감** (RN Animated, **Cell.tsx worklet 무접촉**): 온보딩 dot 스냅→short 트랜지션 / 슬라이드 3 확정 모먼트 1회 모션 / CalendarDatePicker 월 전환 fade / 친구 탭 인디케이터 translateX / MiniTimeGrid reduce-motion 응답. 전부 `Animated`+`useReducedMotion`(D12 worklet 무관, ConfirmSheet/Toast/PlaceActionSheet 선례).
6. **W3-6 지도 마커·MapHost** : MapMarkerView order 배지 §10.5 정합(28→32pt, 숫자 title-3) / 지도 탭 MapHost 구조 정합(D38 이점 공유 — 이미 도입, diff 최소).
7. **Wave 3 종료 게이트**: `npm test` + tsc 0 + eslint 0 + design-guard → `/design-check` §17.7 → **4렌즈 adversarial 리뷰**(토큰·a11y·API·다크; Workflow **또는 spend limit면 메인 루프 직접**) confirmed 수정 → `/run-denda` 라이트/다크(post-login env-blocked면 bundle-level 인정) → docs(SESSION_LOG prepend UI-W3 DONE + NOW.md + 본 kickoff 종료 표기).

## 진행 방식

- 각 항목 **TDD**(테스트 먼저 → 실패 확인 → 구현 → 통과). 스크린 테스트 래퍼 = **SafeAreaProvider(initialMetrics)+ThemeProvider+ToastProvider** 3중.
- 화면군 단위 커밋(green 확인 후). eslint prettier 경고는 `--fix`. 커밋 co-author 유지:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **ultracode**면 기계적 sweep(W3-1/W3-2)·리뷰는 서브에이전트/Workflow 위임. disjoint 파일이면 worktree 불필요, **중앙에서 `eslint --fix` + `tsc --noEmit` + full test + design-guard 재검증**(에이전트 결과 미신뢰).

## 세션5 운영 팁 (시간·비용 절약 — 실전)

- **💸 spend limit 주의**: 세션5에서 **Opus 서브에이전트 6개 동시**(~395k 토큰)가 monthly spend limit을 침 → 전량 실패. 대량 mechanical sweep은 **`model: 'sonnet'` 서브에이전트 + 그룹당 3~4파일 + 규칙에 제외 목록 명시**가 비용·정확도 균형 좋음(Sonnet 5개 병렬은 안전·정확했음). 상한 상태는 서브에이전트 1개 탐침으로 실측(대시보드 직접 조회 불가).
- **병렬 에이전트는 prettier `--fix`를 안 돌림** → 위임 후 중앙에서 `eslint --fix` 필수. 개별 에이전트 tsc는 병렬 중간 상태 → 중앙 `tsc --noEmit` 재확인.
- **flaky timeout**: full suite를 Workflow와 동시에 돌리면 `waitFor` 1~2건 timeout(스택 `asyncGeneratorStep`) 가능 → **단독 재실행하면 green**. 진짜 신호는 "변경 파일 스위트 isolation 실행"이 통과하는가.
- **deno 에지**: PATH 밖 → `/c/Users/skaeh/.deno/bin/deno.exe test <경로> --no-check --allow-net`.
- **design-guard는 테스트 파일 raw hex(#RRGGBB)도 차단**(주석 포함) → 색 비교는 `import { tokens }` 후 `tokens.light.X`. 훅은 stdin JSON(`{"tool_input":{"file_path":"..."}}`) 페이로드 필요 — 인자만 주면 exit 1(아티팩트).
- **Pressable `pressed`는 fireEvent로 못 뒤집음** → 순수 헬퍼 계약만 테스트(`src/design/press.ts` 선례). 애니메이션 색은 rerender 중 interpolation 객체 → 정적 색 검증은 **fresh mount**.
- **`useRef(new Animated.Value()).current`는 `react-hooks/refs` 린트 error** → `useState(() => new Animated.Value())`. `backgroundColor` 애니는 native driver 비호환(`useNativeDriver:false`); transform·opacity는 native OK.
- **모션 감소**: `useReducedMotion()`(AccessibilityInfo 기반, 테스트에서 `jest.spyOn(AccessibilityInfo,'isReduceMotionEnabled').mockResolvedValue(true)` + waitFor). ConfirmSheet/Toast/PlaceActionSheet가 `reduced ? 0 : duration.medium` + `transform: reduced ? [] : [...]` 패턴 선례.

## 불가침 (매 커밋 유지)

- **D12** 시간 그리드 sweep worklet 경로 diff 0(SelectionOverlay·useSweepGesture·Grid GestureDetector·Cell). **W3-5 모션에서 Cell.tsx 절대 무접촉.** 회귀 가드 `tests/regression/`.
- **Phase 3 코드 0** · **Gate #1·#2 로깅 1회성 불변** · **DESIGN 토큰 외 시각 결정 0**(hex·장식 보라·임의 간격·gradient·glassmorphism·indigo).
- **한국어 UI only · KST(luxon, `new Date()` 금지 — `Date.now()` 스로틀은 허용).**
- **의도적 제외 유지(부활 금지)**: press 딤 제외분(ghost brand pill=brand-50 base·아이콘 전용 버튼 opacity·캘린더 날짜 stateful 셀·Gate #2 PlaceActionSheet CTA·profile SettingRow 구조) — Wave 3 대상 아님.
- branch push 유지(origin 추적). config.toml PG 17 확정(재변경 금지).
