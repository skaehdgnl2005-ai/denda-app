# UI 폴리시 실행 — 세션 인수인계 (2026-07-09)

> 이전 세션(2026-07-08~09)이 컨텍스트 한계로 중단. 이 문서 하나로 전체 맥락 복원 가능.
> **다음 세션은 이 파일 + 아래 "먼저 읽을 것"만 읽으면 바로 이어서 작업 가능.**

---

## 0. 30초 요약

- **작업**: 앱 전 화면 "기초적으로 안 다듬어진" 인상 → 디자이너 감사(약 120건) → 종합 플랜(Wave 0~3) 실행.
- **승인된 스코프**: **Wave 0~2** (사용자 결정). Wave 3는 시간 허용 시.
- **진행률**: **Wave 0 100% 완료·ship** + **Wave 1 여정 3모먼트(최우선 P0) 완료·ship**. Wave 1 나머지 + Wave 2 잔여.
- **상태**: 전체 Jest **1067 pass / 1 skip**, tsc **0**, eslint **0**, design-guard CLEAR. 어느 커밋에서든 출시 가능.
- **브랜치**: `feat/map-maphost-m0` (미push, 미PR). 이번 세션 커밋 6개.

---

## 0.5 세션 2 진행 (2026-07-09 이어서) — 10 커밋, 전체 green

> 상태: Jest **1084 pass / 1 skip** · tsc 0 · eslint 0 · design-guard clean · Deno 에지 8/8.
> 로컬 deno는 PATH 밖: `/c/Users/skaeh/.deno/bin/deno.exe` (에지 `_test.ts` 실행용).

### 완료·ship
| 커밋 | 내용 |
|---|---|
| `af13d98` | housekeeping: config.toml PG `15→17`(원격 프로젝트=PostgreSQL 17.6.1.121 확인, `.temp/postgres-version`) + 루트 `deno.lock` gitignore |
| `a9c4f78` | **W1-14 설계 스펙** — [2026-07-09-w1-14-account-deletion-design.md](2026-07-09-w1-14-account-deletion-design.md) |
| `4806335` | **W1-14 회원 탈퇴 풀 구현** — Edge `delete_account`(service_role `admin.deleteUser`, JWT 도출=IDOR 차단, Google 토큰 best-effort revoke) + 2단 ConfirmSheet + authStore.`resetForAccountDeletion`(allSettled·무한로딩 방지) + `clearStoredGoogleToken`. **마이그레이션 0개**(cascade가 전부, RESTRICT FK 없음 직접 재검증). @reviewer Critical-4 CLEARED + adversarial 리뷰 3건(무한로딩·로컬 토큰·dead auth branch) 반영. |
| `cda84cf` | **W1-4·W1-8** friends/index — Alert 7→Toast + 에러 위장 해제(EmptyState error) + Skeleton |
| `1de1d77` | **W1-5** requests — Alert 11→Toast + ActivityIndicator→Skeleton + 에러 위장 해제 |
| `f84b86a` | **W1-4·W1-15** search — Alert 3→Toast + Skeleton + `useKakaoInvite` 훅 추출(index 공유) |
| `8d07509` | **W1-4~6 배치1** — _layout 자동합류→'보러 가기' 액션 토스트(+'모임 탭' 오카피 제거) · login 실패 Alert 제거(인라인 단일화) · new 생성실패→mapError 토스트 |
| `785e1dd` | **W1-5** InviteCodeModal — '건너뛰기' Alert→시트 내 2스텝 확인(중첩 Modal 회피) |
| `c214a8b` | **W1-4·W1-10** invite — 결과 3종 Alert→토스트 + Skeleton + 에러 위장 해제+재시도 |

### 확립 사항(§4 패턴에 추가)
- **effect 안에서 토스트 필요 시** `const { show: showToast } = useToast();`(show는 provider useCallback으로 stable)로 destructure → effect deps에 showToast(재실행 루프 회피). search.tsx 참조.
- **에지 함수 강화 테스트**: `delete_account`는 click_log의 순수-함수-only와 달리 handler를 **deps 주입형**(`DeleteAccountDeps`)으로 만들어 auth·revoke·delete 경로 전체를 mock 검증. 삭제 엔드포인트 급소라 강화.
- **비대화형 행**: profile/설정 pending Alert 3개 → SettingRow `danger`/비-onPress(chevron 숨김)로 정리(죽은 Alert 제거).

### 잔여 (다음 세션 — 파일:라인은 §5·audit)
1. **W1-6 everytime** (`app/schedule/everytime.tsx`) — 이 세션 **유일 미착수 Alert 화면**. Alert 6곳(48 학기미입력→인라인 폼 에러 §11.3 / 59 OCR결과없음·73 OCR실패→error 토스트 / 67 곧활성화→토스트 / 69 권한→ConfirmSheet(설정 이동) / 92 저장실패→mapError 토스트) + ActivityIndicator→Skeleton + OCR 진행 카피.
2. **W1-7 홈** (`app/(tabs)/index.tsx`) — fetch 위장 해제(32-34) + useFocusEffect refetch + RefreshControl. **알림함 Alert(62)는 R2 결정=제거(W2-9)로 함께 처리**.
3. **W1-9 지도** (`app/(tabs)/map.tsx`) — 죽은 결과 카드 Pressable화(PlaceActionSheet 연결) + 첫로드만 Skeleton(이전 결과 유지) + ActivityIndicator 제거.
4. **W1-11** 스플래시 다크 flash(`app/index.tsx`: surface-0+BrandMark+Spinner) · **W1-12** privacy 뒤로 화살표(`(auth)/privacy.tsx:44` ChevronRight→'뒤로') · **W1-13** 약관 전문 화면(`(auth)/terms.tsx:117-151`, privacy Section 재사용).
5. **Wave 1 종료 게이트 미실행**: 다중 에이전트 adversarial 디자인 리뷰(4렌즈: 토큰·a11y·API·다크모드) — **스펜드 한도로 이 세션 Workflow/서브에이전트 위임 전면 불가**. 다음 세션에서 실행. + `/design-check` + `/run-denda` 라이트/다크 스크린샷.
6. 이후 **Wave 2** (§5).

### 주의(이 세션 학습)
- 서브에이전트/Workflow는 **월 스펜드 한도**로 실패할 수 있음(이 세션 배치 위임 4/4 실패) → 한도 여유 없으면 직접 수행.
- ActivityIndicator 잔존(비-W1 화면): login·HostConfirmButton·MapLoading·PlaceActionSheet·schedule/map = **Wave 2**(Button/Spinner 프리미티브 채택 시). W1 대상은 everytime·map·splash만.

---

## 1. 먼저 읽을 것

1. CLAUDE.md 공통 5개 (CLAUDE.md / PROJECT_CONTEXT / **NOW.md** / SESSION_LOG / PROGRESS)
2. **이 파일**
3. [플랜 본문](2026-07-08-ui-polish-design.md) — §3 Wave0 / **§4 Wave1** / **§5 Wave2** / §9 결정(✅ 확정)
4. [감사 findings](2026-07-08-ui-polish-audit-findings.md) — 모든 잔여 항목의 **파일:라인 근거**
5. UI 작업이므로 [DESIGN.md](../../DESIGN.md) §6·§10·§11·§12·§17 + `.claude/rules/design.md` 자동 로드

---

## 2. 확정된 사용자 결정 (재확인 불필요)

| # | 결정 |
|---|---|
| 스코프 | **Wave 0~2** |
| R1 FAB 글리프 (W2-3) | **① Lucide `calendar-days`+`plus` 코드 합성 뷰** (MapMarkerView/D40 선례, PNG 0). §14 D-FAB는 이 합성으로 closure |
| R2 홈 알림 벨 (W2-9) | **① 제거** (알림함은 차기) |
| W1-14 회원 탈퇴 | **풀 구현** — 프론트 2단 ConfirmSheet + **Supabase 삭제 RPC/Edge** (RLS·cascade 포함, @reviewer 강화) |
| overlay 토큰 (W0-8) | 승인 완료 (이미 구현·ship) |

---

## 3. 완료된 것 (커밋)

| 커밋 | 내용 |
|---|---|
| `a1ffdf1` | 플랜 승인 + 결정 4건 + TASK_BACKLOG Lane F(UI-W0/W1/W2) 등록 |
| `9098f93` | WIP 베이스라인 (미커밋이던 캘린더 전환·프로필/홈 착수·D12 gesture root·Skeleton/VoteGuide/CalendarDatePicker) |
| `28ffaaa` | **Wave 0** 프리미티브 전체 |
| `78a5c05` | **W1-2·W1-3** place flow (place-search·midpoint·place) |
| `384dc77` | **W1-1** 모임 확정 (group index + ConfirmedTimeCard 등장 모먼트) |
| `ed45309` | 진행 기록(docs) |

### Wave 0 산출물 (전부 `src/`, TDD, 다중 에이전트 리뷰 11건 반영)
- `components/Button.tsx` — 5 variant, 56/48pt, disabled 회색(§17.5), loading 인라인 Spinner, pressed 색전환. **`buttonPalette` 순수 함수 export**(색 계약 단위 테스트용). destructive는 error.border 테두리.
- `components/Toast.tsx` — `ToastProvider`(app/_layout 루트 장착) + `useToast()`. `show({message, variant?: 'default'|'success'|'error', action?: {label,onPress}, durationMs?})`. success/error는 아이콘+좌측 스트라이프(§12.6). 마운트 시 `announceForAccessibility`.
- `components/ConfirmSheet.tsx` — `{visible, onClose, title, message?, confirmLabel, onConfirm, cancelLabel?, destructive?, loading?, children?, testID}`. §10.3 골격, backdrop=overlay.scrim, `accessibilityViewIsModal`, loading 중 dismiss 차단. **exit 애니 없음**(즉시 언마운트 — reanimated exiting seam 남김).
- `components/EmptyState.tsx` — `{title, body?, icon?, cta?: {label,onPress}, variant?: 'default'|'error', testID}`. §11.2 3요소, 72pt surface-2 아이콘원(보라 금지 D5), error variant.
- `components/ScreenHeader.tsx` — `{title?, onBack?, right?, testID}`. 좌 뒤로(44pt chevron-left)·중앙 title-3·우 슬롯.
- `components/Spinner.tsx` — LoaderCircle 24/16pt, 1s linear, reduce-motion 정적, `decorative` prop(임베드 무음).
- `lib/motion/useReducedMotion.ts` — AccessibilityInfo 기반(§6.4 단일 분기점).
- `lib/motion/easing.ts` — `motionEasing.{standard,enter,exit,emphasized}` = tokens.easing CSS bezier의 RN `Easing.bezier` 대응 함수. **Animated에는 반드시 이걸 사용**(문자열 토큰은 RN Animated 비호환).
- `lib/i18n/messages.ts` — `messages.{action,success,error,empty}` + **`mapError(e) → {silent, message}`**(raw e.message 비노출·취소류 silent).
- `design/tokens.ts` — `overlay.scrim`(light 0.4/dark 0.6) 추가. Skeleton 마감(duration.long·정적). Icon 5종 추가(성공/경고/안내/더하기/삭제).

### Wave 1 완료분 (여정 3모먼트 = Gate #1·#2 클라이맥스)
- **W1-2** `place-search.tsx`·`midpoint.tsx`: Alert 확인 → `ConfirmSheet`(pending state), 확정실패 → error Toast. testID `place-confirm-*` / `mid-confirm-*`.
- **W1-3** `place.tsx`: Alert → success Toast. 로딩 Spinner·에러 EmptyState. testID `place-loading`/`place-error`/`place-none`.
- **W1-1** `group/[id]/index.tsx`: Alert 5곳 제거 → ConfirmedTimeCard 등장(emphasized 애니) + Toast. 로드에러 EmptyState + `reloadKey` refetch. testID `group-load-error`.

---

## 4. ⭐ 확립된 전환 패턴 (일관성 필수 — 잔여 작업은 이걸 기계적으로 적용)

| 케이스 | 전환 |
|---|---|
| Alert 성공/안내 피드백 | `const toast = useToast();` → `toast.show({ message, variant: 'success' })` |
| Alert 확인 (취소/실행 페어) | `const [pending,setPending]=useState(...)` + `<ConfirmSheet visible={pending!==null} .../>` |
| raw `e.message` 노출 | `const {silent,message}=mapError(e); if(!silent) toast.show({message,variant:'error'})` |
| 에러를 빈 상태로 위장 | `<EmptyState variant="error" cta={{label:'다시 시도', onPress: refetch}} />` (refetch = reloadKey++ 패턴) |
| 로딩 | 액션=`<Spinner>` / 리스트·첫fetch=`<Skeleton>` |
| 수제 topBar (10개 화면) | `<ScreenHeader onBack={()=>router.back()} title=... />` (W2-4) |
| 확인 없는 파괴적 액션 | `<ConfirmSheet destructive .../>` |

**스크린 테스트 래퍼 (useToast/ConfirmSheet 쓰는 화면 필수)**:
```tsx
const METRICS = { frame:{x:0,y:0,width:390,height:844}, insets:{top:47,left:0,right:0,bottom:34} };
const wrapper = ({children}) => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
  </SafeAreaProvider>
);
```

---

## 5. 남은 작업 (파일:라인은 감사 findings 참조)

> 잔여 Alert 재확인: `grep -rn "Alert.alert" app/ src/ --include="*.tsx" | grep -v ".test."` (이번 세션 후 **약 38곳 / 11파일**)

### W1-4~6 — Alert 나머지 →0
| 파일 | 대략 곳 | 전환 |
|---|---|---|
| `friends/index.tsx` | 7 | 차단완료·신고접수 → Toast / 로그인필요 → Toast / 오류 → mapError Toast. **에러 위장(38-44)은 W1-8과 함께** |
| `friends/requests.tsx` | 11 | 수락/거절/취소 완료 → Toast / 실패 → mapError Toast / 합류완료 → success Toast / 초대거절 → Toast. **모임 초대 확인은 ConfirmSheet** |
| `friends/search.tsx` | 3 | 요청 보냄 → success Toast / 검색·요청 실패 → mapError Toast |
| `schedule/everytime.tsx` | 6 | 학기 미입력 → **인라인 에러**(§11.3 폼) / OCR 결과없음·실패 → error Toast / 권한 → ConfirmSheet(설정 이동) / 곧활성화 → Toast |
| `_layout.tsx` | 1 | 자동 합류(192-201) → "모임에 합류했어요!" + "보러 가기" **액션 Toast** (존재 안 하는 '모임 탭' 안내 문구 수정) |
| `group/[id]/invite.tsx` | 3 | 초대 결과 3종 → Toast (성공/부분실패 error variant) 후 `router.back()`. 로딩 Skeleton·에러 EmptyState(W1-10) |
| `group/new.tsx` | 1 | 생성 실패 raw → mapError Toast (W2-12에서 KeyboardAvoiding·radius도) |
| `(auth)/login.tsx` | 1 | 로그인 실패 Alert → 인라인 에러 경로와 이중화 해소(인라인만) |
| `InviteCodeModal.tsx` | 1 | '나중에' Alert → ConfirmSheet 또는 시트 내 처리 |
| `profile.tsx` | 3 | pending 행 Alert → non-pressable + '준비 중' pill(이미 있음) 유지 or Toast. **W1-14와 함께 작업** |

### W1-7~9 — 상태 디자인
- **W1-7 홈** `(tabs)/index.tsx:32-34`: fetch 실패가 빈 상태로 위장 → error 분리 + EmptyState error. **+ `useFocusEffect` refetch**(모임 생성 후 복귀 미갱신) + `RefreshControl`.
- **W1-8 친구** `friends/index.tsx`: 위장 해제 + FriendCard 모양 Skeleton 3~4장.
- **W1-9 지도** `(tabs)/map.tsx`: 결과 카드가 **탭 불가능한 죽은 View → Pressable화**(place-search 카드 패턴, PlaceActionSheet 연결) + 타이핑마다 전체 스피너 → 이전 결과 유지+첫 로드만 Skeleton.

### W1-11~14 — 첫인상·신뢰
- **W1-11** `app/index.tsx:19-30`: 스플래시 다크 흰 flash → surface-0 배경 + BrandMark + Spinner.
- **W1-12** `(auth)/privacy.tsx:44`: 뒤로가기가 **오른쪽 화살표(ChevronRight)로 렌더** → Icon '뒤로'. ScreenHeader 적용 시 자연 해소.
- **W1-13** `(auth)/terms.tsx:117-151`: 약관 전문 화면 부재(법적 리스크) → chevron 별도 Pressable로 전문 화면 push (privacy Section 재사용).
- **W1-14 회원 탈퇴 (백엔드 포함, 가장 무거움)** `profile.tsx`: '관리' 섹션 SettingRow + **2단 ConfirmSheet**(destructive) + **Supabase 삭제 RPC/Edge**(RLS·cascade — `users` + 연관 데이터). 스토어 심사 요건 P0. rules/supabase.md 준수(RLS·SECURITY DEFINER 신중). **@reviewer 강화 리뷰 필수**.

### W1-15
- `friends/search.tsx:181-184` '카톡으로 친구 초대' no-op → `useKakaoInvite` 훅 추출(index.tsx 로직 공유, `src/lib/share/inviteShare.ts` 있음).

### 이후 Wave 2 (§5) — 셸·그리드 시각·화면 마감
- W2-1 탭바 safe area·아이콘 24 / W2-2 다크 네비 배경 / **W2-3 중앙 FAB(Lucide 합성)** / W2-4 ScreenHeader 10화면 일괄
- W2-5 그리드 요일 헤더 / W2-6 히트맵 색전환+heat-4 축하(broadcast 경로만, **worklet 무접촉**) / W2-7 셀 a11y·RefreshControl·ConfirmedTimeCard 위계+다크 배경 보정
- W2-8~15 pressed 색전환·홈 실데이터+**벨 제거**·친구 잠금/pull-refresh·캘린더 row·new KeyboardAvoiding·SearchField·카피 톤·PlaceActionSheet/ConfirmSlotSheet §10.3 이관

---

## 6. ⚠️ Gotchas (이번 세션에 학습 — 시간 절약)

- **design-guard**는 PostToolUse로 **파일 전체 재스캔** → 테스트 파일 주석의 기존 hex(#RRGGBB)도 트립. de-literalize하면 됨. `tokens.ts`/`theme.ts`만 hex 예외.
- **RNTL 기본 쿼리는 a11y-hidden 요소 제외**: `accessibilityViewIsModal`(시트) 옆 형제, `accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`가 걸린 요소는 `getByTestId`가 **못 찾음** → `getByTestId(id, { includeHiddenElements: true })`. (그래서 ConfirmSheet backdrop 테스트가 그럼.) 단순 무음은 `accessible={false}`만(쿼리 가능).
- **Pressable pressed 상태**는 responder 계층이라 `fireEvent(el,'pressIn')`으로 안 뒤집힘 → 색 전환은 **순수 헬퍼(buttonPalette 등)로 단위 테스트**.
- **tokens.test.ts 구조 테스트**가 light/dark 키 parity 강제 → 토큰 추가 시 양쪽 다.
- **`useSafeAreaInsets`**는 SafeAreaProvider 없으면 **throw**(자동 mock 아님) → 테스트 래퍼에 `initialMetrics` 필수.
- **Icon testID 미전파**(lucide svg로 감) → 쿼리하려면 `<View testID>`로 감싸기.
- **react-hooks/set-state-in-effect** = error → ConfirmSheet는 enter-only 애니(exit 없이)로 우회.
- **useCallback가 toast 쓰면 deps에 toast** 넣기(exhaustive-deps).
- 스크린이 `useToast` 쓰면 그 스크린 테스트 래퍼에 **ToastProvider** 추가 필수(안 그러면 "must be used within a ToastProvider" throw).

---

## 7. 🔒 불가침 (매 커밋 유지)

- **D12**: 시간 그리드 sweep **worklet 경로 diff 0** (히트맵 시각 레이어만 건드림). 회귀 가드 `tests/regression/`.
- **Phase 3 코드 0**: 토스/reservations/payments/payouts/F6·F7/식당 어드민 (design-guard 차단).
- **Gate #1·#2 로깅 1회성 불변**: `logReservationClick`·`confirmGroup`·usePlaceConfirmAction idempotency.
- **DESIGN 토큰 외 시각 결정 금지** (hex·임의 간격·장식 보라). 예외: Button의 Kakao rgba·press overlay(login.tsx 선례).
- **한국어 UI only** · KST(luxon, `new Date()` 금지).

---

## 8. 검증 게이트 (각 wave 종료 시)

```bash
npm test                    # Jest 전체 그린 유지 (현재 1067 pass)
npx tsc --noEmit            # 0
npx eslint <changed files>  # 0 (--fix로 prettier 정리)
# design-guard: 신규 hex/new Date/indigo/gradient/금지폰트 0
```
- 각 wave는 **화면군 단위 커밋**. Wave 종료 시 **다중 에이전트 adversarial 디자인 리뷰**(Workflow, 4렌즈: 토큰·a11y·API·다크모드) 권장 — Wave 0에서 19제기→11확정→전부 수정으로 유효성 확인됨.
- 커밋 co-author: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## 9. 미결 (사용자 확인 대기)

- **`supabase/config.toml`** PG `major_version 15→17` — UI 폴리시와 무관한 로컬 아티팩트로 판단, **모든 커밋에서 제외**. 의도 여부 사용자 확인 필요. (`deno.lock`도 미커밋 상태.)
