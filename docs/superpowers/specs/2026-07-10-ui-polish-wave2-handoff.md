# UI 폴리시 실행 — Wave 2 인수인계 (2026-07-10, 세션4)

> Wave 2(승인 스코프 마지막 웨이브) 13/15 완료·ship. 이 문서로 잔여 2건 + 후속 이어서 작업 가능.
> 선행: Wave 1 handoff `2026-07-09-ui-polish-wave1-handoff.md`, 플랜 SSoT `2026-07-08-ui-polish-design.md` §5, audit `2026-07-08-ui-polish-audit-findings.md`.

---

## 0. 30초 요약

- **완료 13/15** (8 커밋 `1a103bd`~`adac285`): W2-1·2·3·4·5·6·7·9·11·12·13·14·15 + W2-10 부분.
- **전체 green**: Jest **1177 pass / 1 skip** · tsc 0 · eslint 0 · design-guard clean · **D12 회귀 가드 green**.
- **종료 게이트 통과**: 자동 design-guard sweep(hex·new Date·indigo·gradient 0) + **4렌즈 adversarial 리뷰**(토큰·a11y·API·다크 — a11y 0건, 4 confirmed 전부 수정 `adac285`).
- **잔여 2/15 + 후속 1**: W2-8(pressed sweep), W2-10 requests 탭, PlaceActionSheet Modal 모션 rework. 아래 §3.
- **branch** `feat/map-maphost-m0`. config.toml PG 15→17은 `af13d98` 반영·확정(미결 종료).

---

## 1. 완료분 (커밋 표)

| 커밋 | 항목 | 핵심 |
|---|---|---|
| `1a103bd` | **W2-4** | ScreenHeader 10화면 일괄. 백버튼 쿼리 testID→accessibilityLabel '뒤로 가기'. h2→h3(nav 표준). |
| `a7bf5b2` | **W2-1·2·3** | 탭바 safe area(useSafeAreaInsets)+아이콘 24+focused fill(Icon `fill` prop) / 중앙 FAB `GroupFab`(Lucide 캘린더+더하기 합성, radius-md, brand-500 e4, press scale 0.96, reduce-motion) / 다크 네비 배경(5 _layout contentStyle surface-0, root는 `RootStack` 자식 추출). 순수 헬퍼 `src/lib/nav/tabBar.ts`. |
| `f55fa8f` | **W2-6·7a** | `Cell.tsx` 히트맵 색전환 모션(broadcast JS 경로만, inner Animated.View `-bg` 레이어, heat-4 진입 xLong+emphasized, reduce-motion 스냅) + 셀 a11y 날짜·시간·인원. **D12 worklet(SelectionOverlay·useSweepGesture·Grid GestureDetector) diff 0.** |
| `2a66fee` | **W2-5·7b** | 요일 헤더 2줄(`src/lib/datetime/dayHeader.ts` formatDayHeader/KO_WEEKDAY 공용) + RealtimeStatus 카피 + ConfirmedTimeCard 위계·다크(surface-2, `confirmedCardSurface`) + group 상세 재진입 refetch(useFocusEffect+didFocusRef). |
| `923d11c` | **W2-13** | 공용 `SearchField` 프리미티브 + map·place-search 적용. |
| `bfaf58a` | **W2-10 부분** | FriendCard 죽은 '최근 모임' 제거+pressed surface-3 / search(SearchField·in-flight 잠금·빈 CTA) / index 배지 합산(요청+초대). |
| `460f772` | **W2-9·11·12·14·15** | 병렬 구현 5종 — 홈 실데이터(`stats.ts` countGroupsThisMonthKst) / 프로필 캘린더·약관 row / group-new KeyboardAvoiding·atMax·radius·a11y / MapPlaceholder 카피 / 시트 CTA·backdrop·grabber·radius. |
| `adac285` | **게이트** | 4렌즈 confirmed 4건: profile 연결됨 오표기→끊김일 때만 행 / friends 배지 커플링→try-catch 분리 / 홈 off-scale margin→space['0.5'] / 홈 배지 다크→surface-3. |

### 신규 프리미티브/헬퍼 (재사용)
- `src/components/GroupFab.tsx` — 중앙 FAB(자산 0, MapMarker/D40 선례). onPress override 가능.
- `src/components/SearchField.tsx` — `{value,onChangeText,onClear?,onSubmit?,placeholder?,accessibilityLabel,autoFocus?,testID?}`. clear testID=`${testID}-clear`, container=`${testID}-container`.
- `src/lib/nav/tabBar.ts` — `tabBarHeightStyle(insetsBottom)`·`focusedTabFill(focused,tint)`·`fabBottomOffset(insetsBottom)`.
- `src/lib/datetime/dayHeader.ts` — `formatDayHeader(iso)→{weekday,date}`·`KO_WEEKDAY`. (ConfirmSlotSheet·ConfirmedTimeCard 로컬 복사는 미통합 — 후속 정리 여지.)
- `src/lib/groups/stats.ts` — `countGroupsThisMonthKst(groups, nowKstIso)` (이번 달 모임 = 후보 날짜 in KST 이번 달).
- Icon `fill?` prop 추가(focused 채움 2차 신호). Cell `cellBackgroundColor(state,colors)` export. ConfirmedTimeCard `confirmedCardSurface(isDark,colors)` export.

---

## 2. ⭐ 확립/신규 패턴 (이어서 기계 적용)

- **다중 에이전트 병렬**: 스카웃(15 read-only)→헤더 스왑(8 disjoint)→화면 구현(5 disjoint)→4렌즈 리뷰(4). 모두 disjoint 파일이면 worktree 불필요, 중앙에서 tsc+full test+eslint --fix 검증. (에이전트는 prettier --fix를 안 돌리니 중앙에서 `eslint --fix` 필수.)
- **모션(비-worklet)**: RN `Animated` + `useReducedMotion` + `motionEasing`(집 스타일; Skeleton/Toast/ConfirmedTimeCard). backgroundColor는 native driver 비호환 → `useNativeDriver:false`. `useRef(new Animated.Value()).current`는 `react-hooks/refs` 린트 걸림 → **`useState(()=>new Animated.Value())`**.
- **다크 배경**: brand-50은 다크에서 6% 알파=투명 → 가시 표면 필요 시 `isDark ? surface[2/3] : brand[50]`(순수 helper 분리해 두 모드 계약 테스트).
- **safe area / 순수 헬퍼**: 레이아웃 계산은 순수 함수로 뽑아 단위 테스트(buttonPalette 선례).
- **재진입 refetch**: `useFocusEffect`+`didFocusRef`(첫 포커스=마운트 skip). 테스트는 expo-router mock에 `useFocusEffect:(cb)=>useEffect(()=>cb(),[cb])` 추가.
- **부차 정보 격리**: 배지 등 부차 데이터 fetch 실패가 주 콘텐츠를 에러로 가리지 않게 try/catch 분리(리뷰 confirmed).

---

## 3. 잔여 작업 (파일:라인 근거는 audit + 아래)

### W2-8 — pressed 색전환 전면 sweep (최저 우선, ~32 파일)
- 스펙 §5.3 W2-8: opacity pressed → **카드/행 surface[3]**, **brand fill CTA brand[600]**. 아이콘 버튼(opacity 0.6)·카톡(외부색)은 예외/후속.
- 이미 반영: Button 프리미티브, FriendCard, 홈 my-group 카드(W2-9). 잔여 대상 전체 목록은 스카웃 W2-8 report(리뷰 원본) 참조 — 브랜드 CTA ~13곳, 카드/행 ~11곳.
- **권장**: `src/design/press.ts`에 `rowPressBg(pressed,colors)`·`ctaPressBg(pressed,colors)` 순수 헬퍼 신설 + 계약 테스트(light/dark), 화면별 인라인 교체. Pressable pressed는 fireEvent로 못 뒤집으니 순수 함수 계약만 테스트.
- **⚠️ Cell.tsx L?(opacity 0.8)은 60fps/D12 위험 — 범위 제외.**

### W2-10 requests 탭 (+ search pull-refresh)
- `app/(tabs)/friends/requests.tsx`: (1) in-flight 잠금 — handleAccept/Reject/Cancel/InvitationAccept/InvitationReject에 pending Set 가드(더블탭 중복 RPC 방지). FriendRequestCard에 `pending`/`disabled` prop 추가(§17.5 회색, testID accept/reject/cancel-button 보존). (2) pull-to-refresh — 두 FlatList에 RefreshControl(refreshing state + onRefresh=refetch). (3) 빈 상태 CTA — 'incoming'(받은 요청 없음)→'친구 검색하기', 'invitations'(모임 초대 없음) 빈 상태.
- `app/(tabs)/friends/search.tsx`: 결과 FlatList에 RefreshControl(별도 `refreshing` state, `loading`(skeleton)과 구분). 이미 SearchField·in-flight·빈 CTA는 완료.
- 테스트: requests.test에 invitationsApi 이미 mock됨. search.test는 fake timers 주의.

### PlaceActionSheet Modal 모션 rework (W2-15 스코프 제외분)
- `src/components/place/PlaceActionSheet.tsx` Modal `animationType="slide"`(RN 기본) → §6.5 시트 up = duration-medium(250)+easing-enter. `animationType="none"` + Animated translateY/opacity(JS 드라이버, worklet 무관) + exit + **reduce-motion(§6.4 micro/fade)**. 이미 CTA 56·backdrop overlay.scrim·grabber·radius-2xl는 완료.

---

## 4. ⚠️ Gotchas (세션4 학습)

- **design-guard는 테스트 파일 raw hex도 차단** → 테스트에서 색 비교 시 `import {tokens}` 후 `tokens.light.X`(literal `#…` 금지, 주석에도).
- **inner bg 레이어 testID 충돌**: Cell `${testID}-bg`가 `/^grid-cell-/` 카운트 정규식에 잡힘 → 카운트 테스트는 `/^grid-cell-\d+-\d+$/`로 정밀화.
- **rerender vs fresh mount**: 애니메이션 색은 전환 중 interpolation 객체 → 정적 색 검증은 fresh mount로(전환 안 유발).
- **CRLF 경고**는 무해(줄바꿈 정규화).
- **에이전트 위임 후 중앙에서 `eslint --fix`**(에이전트가 prettier 안 돌림) + `tsc --noEmit`(에이전트 개별 tsc는 병렬 중간 상태) 재검증.

---

## 5. 🔒 불가침 (전부 준수 중)

- **D12** 시간 그리드 sweep worklet 경로 diff 0(히트맵 시각 레이어만). 회귀 가드 `tests/regression/`.
- **Phase 3 코드 0** · **Gate #1·#2 로깅 1회성 불변** · **DESIGN 토큰 외 시각 결정 0** · **한국어 UI only · KST(luxon, new Date() 금지; Date.now() 스로틀은 허용)**.
- group 상세 pull-to-refresh는 드래그 그리드 60fps 보호 위해 focus-refetch로 대체(pull은 별도 run-denda 검증 후 도입).

---

## 6. ✅ 세션5 종료 기록 (2026-07-10) — Wave 2 완결

세션4 잔여 2건 + 시트 모션 + W2-8 헬퍼를 TDD로 완결. **승인 스코프(Wave 0~2) 종료.** 3 커밋(`61a5c8f`·`2ed4282`·`4eaa3ac`).

- **W2-10** (`61a5c8f`): FriendRequestCard `pending` prop(§17.5 surface-2+text-tertiary 회색+onPress 차단) / requests.tsx `pendingRef`(동기 더블탭)+`pendingIds`(시각) 가드 5핸들러, `loadData`(무-스켈레톤 refetch) 분리, 두 FlatList RefreshControl, 빈 CTA(친구 검색하기·모임 만들기) / search.tsx 결과 pull-to-refresh(별도 refreshing). testID 보존.
- **PlaceActionSheet 시트 모션** (`2ed4282`): Modal `animationType` slide→none, RN Animated 자체 슬라이드 up(medium+enter)·backdrop 페이드·exit 후 언마운트(`rendered` 상태)·reduce-motion 즉시. **ConfirmSheet 선례 미러** — enter+exit 추가가 차이. Gate #2 로깅·lockRef·CTA56·scrim·grabber·radius-2xl 불변. **RN Animated=Reanimated 워클릿 아님 → D12 무접촉.**
- **W2-8** (`4eaa3ac`): `src/design/press.ts` 신설 — `rowPressBg(pressed,colors,base='transparent')→surface[3]` · `ctaPressBg(pressed,colors)→brand[600]↔500`. light/dark 계약 7 tests. 초기 sweep 8파일(양 버킷). opacity 딤→§9.1 색전환.

### 검증
- Jest **1198 pass / 1 skip**(신규 21), tsc 0, eslint 0, design-guard clean(13 파일), D12 회귀 가드 green.
- **자체 4렌즈 리뷰**(Workflow는 월 spend limit로 전량 실패 → 메인 루프 수행: 토큰·a11y·API·다크) — confirmed 0.
- /run-denda 실기 = post-login keyhash env-blocked → **bundle-level(tsc+test) 인정**(디바이스 런=사용자 트랙).

### ⏭️ W2-8 잔여 sweep (기계적 후속, 계약 고정)
press.ts 헬퍼는 확립·검증 완료. 잔여 화면의 인라인 `opacity: pressed` → `rowPressBg`/`ctaPressBg` 교체만 남음. 대상: **terms·InviteCodeModal·map·requests/search 재채택·group[id]/index·midpoint·invite·ConfirmSlotSheet·FirstTimeModal·CalendarDatePicker·CourseRow·OriginInput·MapPlaceholder·profile.** 규칙: brand[500] bg→ctaPressBg / surface-N 행·카드→rowPressBg(base 넘김) / disabled·busy 분기 보존.
**제외(후속 아님, 의도적)**: Cell.tsx(60fps/D12)·아이콘 전용 버튼(opacity 0.5/0.6 유지)·ghost brand pill(brand-50 base)·캘린더 날짜셀(stateful bg)·Gate #2 PlaceActionSheet CTA(리스크 회피).

### 세션5 특이사항 (인수인계)
- **spend limit**: 월 spend limit로 서브에이전트 전량 실패(sweep 6/6, 리뷰 Workflow). sweep·리뷰는 **메인 루프에서 직접** 수행. 다음 세션도 서브에이전트 불가 가능성 → 직접 수행 대비.
- sweep 에이전트가 죽기 전 place-search·HostConfirmButton은 완결(검수 후 채택), everytime·ReauthModal은 import만 추가→메인 루프에서 마감.
