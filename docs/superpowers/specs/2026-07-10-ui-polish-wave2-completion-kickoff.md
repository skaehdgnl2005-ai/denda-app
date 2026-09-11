# UI 폴리시 플랜 실행 — Wave 2 완결 (잔여 2건 + 시트 모션) — 착수 인수인계 2026-07-10 (세션5)

> 다음 세션 시작 시 이 문서 하나 + "먼저 읽을 것"만 읽으면 바로 이어서 작업 가능.
> 기술 상세(완료분·파일:라인·확립 패턴·Gotchas)는 `2026-07-10-ui-polish-wave2-handoff.md`가 담당.

---

## 상황

- 앱 전 화면 UI 폴리시 플랜(Wave 0~2 승인) 실행 중. **Wave 0 + Wave 1 전량 + Wave 2 13/15 완료·ship·push.**
- 이번 세션 = **Wave 2 완결(15/15) + 종료 게이트**. 승인 스코프의 마지막.
- 전체 green: **Jest 1177 pass / 1 skip · tsc 0 · eslint 0 · design-guard clean · D12 회귀 가드 green.**
- 브랜치 `feat/map-maphost-m0` **push 완료**(origin 추적, `171199f`). PR 미생성.
- 미결 없음(config.toml PG 17 확정). run-denda 실기는 사용자 트랙(keyhash 미등록 → post-login env-blocked).

## 먼저 읽을 것 (CLAUDE.md 공통 5개 외)

1. `docs/superpowers/specs/2026-07-10-ui-polish-wave2-handoff.md` ← **필독**. §1 완료분(커밋·신규 프리미티브/헬퍼) · §2 확립 패턴 · **§3 잔여(파일:라인·접근법)** · §4 Gotchas · §5 불가침.
2. `docs/superpowers/specs/2026-07-08-ui-polish-design.md` §5.3(W2-8)·§5.2 끝(W2-15 시트) — 스펙 SSoT.
3. `docs/superpowers/specs/2026-07-08-ui-polish-audit-findings.md` — friends-tab(requests) 감사 + W2-8 대상 근거.
4. `docs/NOW.md`(Wave 2 잔여 명시) · `docs/SESSION_LOG.md` 최근(UI-W2 PARTIAL).
5. UI 작업 → `docs/DESIGN.md` §9.1(pressed=surface 색)·§6.4·§6.5(모션)·§10.3(예약 시트)·§17 + `.claude/rules/design.md` 자동 로드.

## 착수 순서 (권장 — 위험↓·가치↑, 상세는 handoff §3)

0. **baseline**: `npm test` green(1177) 확인 후 착수. (Deno 에지 = PATH 밖 `/c/Users/skaeh/.deno/bin/deno.exe test <경로> --no-check --allow-net`)

1. **W2-10 requests 탭 (정합성 — 가장 값어치)** `app/(tabs)/friends/requests.tsx` + `src/components/friends/FriendRequestCard.tsx`
   - **in-flight 잠금**(더블탭 중복 RPC 방지): handleAccept/Reject/Cancel/InvitationAccept/InvitationReject에 pending Set 가드(요청 id별). FriendRequestCard에 `pending`/`disabled` prop 추가 → §17.5 회색 + onPress 차단. **testID accept-button/reject-button/cancel-button 보존.**
   - **pull-to-refresh**: 두 FlatList(invitations·requests)에 RefreshControl(`refreshing` state + onRefresh=refetch, tintColor brand[500]).
   - **빈 상태 CTA 2곳**: 'incoming'(받은 요청 없음)→'친구 검색하기'(push /friends/search), 'invitations'(모임 초대 없음) 빈 상태 §11.2.
   - `app/(tabs)/friends/search.tsx`: 결과 FlatList pull-refresh(별도 `refreshing` state — `loading` skeleton과 구분). SearchField·in-flight·빈 CTA는 이미 완료.
   - 테스트: requests.test에 invitationsApi 이미 mock. search.test는 **fake timers** 주의.

2. **PlaceActionSheet Modal 모션 (작음)** `src/components/place/PlaceActionSheet.tsx`
   - `animationType="slide"`(RN 기본) → §6.5 시트 up = **duration-medium(250) + easing-enter**. `animationType="none"` + Animated translateY/opacity(**JS 드라이버 = worklet 무관, D12 무접촉**) + exit + **reduce-motion(§6.4 micro/fade)**. CTA 56·backdrop overlay.scrim·grabber·radius-2xl는 이미 완료(재작업 금지).

3. **W2-8 pressed 색전환 sweep (최저 우선, ~32파일)**
   - `src/design/press.ts` 순수 헬퍼 신설: `rowPressBg(pressed,colors)→surface[3]` · `ctaPressBg(pressed,colors)→brand[600]/brand[500]`. 계약 테스트(light/dark 양쪽). 화면별 인라인 `style={({pressed})=>...}` 교체.
   - 이미 반영: Button·FriendCard·홈 my-group 카드. **Cell.tsx(60fps/D12)·Kakao 버튼(외부색)·아이콘 버튼(opacity 0.6)은 제외.**
   - 시간 부족 시 부분(브랜드 CTA + 카드/행 두 버킷만) → 나머지 후속.

4. **Wave 2 완결 게이트**: `npm test` + tsc 0 + eslint 0 + design-guard → **4렌즈 adversarial 리뷰**(Workflow: 토큰·a11y·API·다크) confirmed 수정 → `/run-denda` 라이트/다크(post-login env-blocked면 **bundle-level(tsc+test) 인정**) → docs(**SESSION_LOG prepend UI-W2 → DONE 15/15** + NOW.md + handoff 종료).

## 진행 방식

- 각 항목 **TDD**(테스트 먼저 → 실패 확인 → 구현 → 통과). 스크린 테스트 래퍼 = **SafeAreaProvider(initialMetrics)+ThemeProvider+ToastProvider** 3중.
- 화면 단위 커밋(green 확인 후). eslint prettier 경고는 `--fix`. 커밋 co-author 유지:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **ultracode**면 스카웃·리뷰는 Workflow 위임(세션4에서 스카웃 15/헤더 8/화면 5/리뷰 4 전부 성공). **disjoint 파일이면 worktree 불필요**, 중앙에서 **`eslint --fix` + `tsc --noEmit` + full test** 재검증.

## 세션4 운영 팁 (시간 절약)

- **병렬 에이전트는 prettier `--fix`를 안 돌림** → 위임 후 중앙에서 `eslint --fix` 필수.
- **design-guard는 테스트 파일 raw hex(#RRGGBB)도 차단**(주석 포함) → 테스트에서 색 비교 시 `import { tokens }` 후 `tokens.light.X`.
- **inner bg 레이어 testID 충돌**: `${testID}-bg`가 `/^grid-cell-/` 카운트 정규식에 잡힘 → `/^grid-cell-\d+-\d+$/`로 정밀화.
- **애니메이션 색은 rerender 중 interpolation 객체** → 정적 색 검증은 **fresh mount**(전환 안 유발).
- **`useRef(new Animated.Value()).current`는 `react-hooks/refs` 린트 error** → `useState(() => new Animated.Value())`.
- **useFocusEffect 테스트**: expo-router mock에 `useFocusEffect: (cb) => useEffect(() => cb(), [cb])` 추가(첫 포커스=마운트).
- **부차 fetch(배지 등)는 try/catch 분리** — 실패가 주 콘텐츠를 에러로 가리지 않게(리뷰 confirmed).

## 불가침 (매 커밋 유지)

- **D12** 시간 그리드 sweep worklet 경로 diff 0(SelectionOverlay·useSweepGesture·Grid GestureDetector·Cell은 worklet 없음). 회귀 가드 `tests/regression/`.
- **Phase 3 코드 0** · **Gate #1·#2 로깅 1회성 불변** · **DESIGN 토큰 외 시각 결정 0**(hex·장식 보라·임의 간격·gradient·glassmorphism·indigo).
- **한국어 UI only · KST(luxon, `new Date()` 금지 — `Date.now()` 스로틀은 허용).**
- group 상세 **pull-to-refresh는 focus-refetch로 대체**(드래그 그리드 60fps 보호; pull은 별도 run-denda 검증 후에만).
- branch push 완료(origin 추적) — 이후 커밋도 push 유지. config.toml PG 17 확정(재변경 금지).
