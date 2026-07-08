# UI 폴리시 종합 플랜 — 출시 전 "기초적 UI" 전면 개선 (2026-07-08)

> **상태**: ✅ **승인 (2026-07-08)** — 스코프 **Wave 0~2**. 결정 4건 확정 (§9): R1=①Lucide 합성 FAB, R2=①알림 벨 제거, W1-14=풀 구현(front+삭제 RPC), overlay 토큰(W0-8) 승인 포함.
> **범위**: Phase 1+2 전 화면 시각·인터랙션 완성도. 새 기능 0, Phase 3 코드 0.
> **감사 근거**: 전 화면 디자이너 감사 — 12개 영역, 약 120건 findings (멀티에이전트 감사 7영역 + 직접 감사 5영역). 원본: [2026-07-08-ui-polish-audit-findings.md](2026-07-08-ui-polish-audit-findings.md).
> **기준선**: [DESIGN.md](../../DESIGN.md) §0~§17 (특히 §11 상태 토큰, §17 anti-AI-feel), D5 Purple Discipline, D12 60fps 불가침.

---

## 1. 배경 · 목표

앱은 기능 여정(모임 생성→투표→확정→장소→클릭 로깅)이 완성됐고 토큰 규율(hex 0, 간격/radius 토큰 참조)은 상급이다. 그러나 사용자 피드백대로 **"기초적으로 다듬지 않은" 인상**이 남는다. 감사 결과, 이 인상은 화면 개별 문제가 아니라 **3가지 계통 원인**에서 나온다:

| # | 계통 원인 | 수치 근거 |
|---|---|---|
| **C1** | **공용 프리미티브 부재** — Button·Toast·EmptyState·BottomSheet·ScreenHeader·Spinner가 없어 화면마다 재구현 → 품질 편차 | `src/design/`엔 tokens·theme·typography만. 56pt CTA 4벌 중복, 헤더 10벌 중복, radius 불일치(new.tsx `lg` vs invite.tsx `md`) |
| **C2** | **상태·피드백이 시스템 기본값** — 성공/실패/확인이 전부 시스템 Alert, 로딩·에러가 미설계 | **Alert.alert 48곳/15파일** (§11.3 명시 금지), ActivityIndicator 10파일(§11.1 스펙 밖), 에러가 빈 상태로 위장 2곳, raw `e.message` 노출 6곳+ |
| **C3** | **모션·모먼트 레이어 0** — 제품 클라이맥스(확정)가 무표정, 모션 감소 응답 전무 | `isReduceMotionEnabled` 사용 0건, heat-4 축하 모션(§6.5) 미구현, pressed 피드백 전부 opacity 단일(§9.1 위반) |

**목표**: 안암 invite-only 출시 전, 핵심 여정(Gate #1·#2 경로)이 "완성된 제품"으로 느껴지게 한다. 측정 가능한 완료 조건은 §6 검증 참조.

**참고**: 사용자가 지목한 "날짜 선택이 달력이 아닌 버튼" 문제는 작업 트리 WIP(`CalendarDatePicker`, 미커밋)로 이미 해소 방향 — 본 플랜은 해당 WIP의 마감 항목을 포함해 커밋까지 이어간다.

---

## 2. 접근안 비교

| 접근 | 내용 | 장점 | 단점 |
|---|---|---|---|
| **A. 프리미티브 우선 (권장)** | Wave 0에서 공용 컴포넌트 6종+훅을 먼저 만들고, 이후 화면 전환을 웨이브로 진행 | 계통 원인(C1~C3)을 근본 해결. Alert 48곳 전환이 기계적 치환이 됨. 이후 신규 화면 비용 급감 | 첫 1~1.5일간 눈에 보이는 화면 변화 없음 |
| B. 화면별 순차 폴리시 | 홈→그리드→장소… 화면당 완결 | 화면 단위 가시 성과 빠름 | 토스트/버튼을 화면마다 재발명 — 총비용 증가, 편차 재생산 (현 상태의 원인 반복) |
| C. 최소 컷 | P0만 (여정 3모먼트 + 첫인상 결함 6건) | 최속 (~2일) | Alert 40여 곳·상태 디자인 격차 잔존 — "미완성" 인상 부분 해소에 그침 |

**권장: A**, 단 스코프 게이트를 웨이브 단위로 둔다 — **Wave 0+1 = 출시 필수, Wave 2 = 강력 권장, Wave 3 = 시간 허용 시**. 속도가 필요하면 Wave 2에서 컷해도 계통 문제는 잡힌 상태로 출시된다.

---

## 3. Wave 0 — 디자인 시스템 프리미티브 (기반, ~1.5일)

모든 후속 웨이브의 선행. 전부 TDD (컴포넌트 테스트 먼저). 위치는 `src/components/` (기존 Icon·Skeleton 관례).

| ID | 산출물 | 스펙 (DESIGN 참조) | 대체 대상 |
|---|---|---|---|
| **W0-1** | `Button.tsx` | variant `primary`(brand-500 fill, pressed=brand-600)·`secondary`(surface-1+border)·`ghost`(surface-2)·`destructive`(error-fg 텍스트, §10.6)·`kakao`. 높이 56pt(주요)/48pt(시트 내). disabled=surface-2+text-tertiary(§17.5 revised), loading=인라인 스피너+라벨 유지(§11.1), pressed는 opacity가 아닌 **색 전환**(§9.1, duration-instant). disabled press 시 0→0.1 overlay(§17.5) | login·onboarding·terms·new·invite·HostConfirmButton 등 CTA 5벌+ |
| **W0-2** | `Toast.tsx` + `ToastProvider`(루트 장착) | e3, surface-1+border-subtle, radius-md, in/out duration-short + easing-enter/exit(§6.5), variant default/success/error(시맨틱 색+**아이콘 동반** §12.6), 선택적 액션 버튼("보러 가기") | **Alert.alert 48곳 중 성공/안내 피드백 전부** |
| **W0-3** | `ConfirmSheet.tsx` (공용 바텀시트) | §10.3 골격: radius-2xl 상단, grabber 36×4 surface-3, e3, backdrop 탭 닫기, duration-medium + easing-enter/exit. 타이틀(title-3)+본문(body-sm)+버튼 페어(ghost/primary 또는 destructive) 프리셋. ReportBlockSheet·PlaceActionSheet 골격 재사용 | Alert 확인류(로그아웃·차단·장소 확정·확정 confirm), ConfirmSlotSheet 컨테이너(§10.3 미준수 해소) |
| **W0-4** | `EmptyState.tsx` | §11.2 3요소 강제: 아이콘 원(72pt, surface-2 원 + text-secondary 아이콘 — 보라 금지 D5)+title-3 헤드라인+body-sm 보조+선택 CTA. 에러 variant: error 시맨틱+아이콘+"다시 시도" CTA(§11.3) | 홈·친구·지도·초대·요청함의 제각각 빈/에러 상태 7벌 |
| **W0-5** | `ScreenHeader.tsx` | 좌 뒤로(44pt, Icon '뒤로'), 중앙 title-3, 우 액션 슬롯(없으면 44pt spacer), inset space-4/수직 space-3 | 10개 화면의 수제 topBar (privacy의 잘못된 화살표 방향 같은 결함 원천 차단) |
| **W0-6** | `Spinner.tsx` | Lucide loader-2, 24pt(인라인 16pt), text-brand, 1s linear 회전, reduce-motion 시 정적 표시(§11.1·§6.4) | ActivityIndicator 10파일 |
| **W0-7** | `useReducedMotion` 훅 | Reanimated `useReducedMotion` 래핑 또는 AccessibilityInfo 구독. §6.4 규칙(medium 이상→micro, spring→fade)의 단일 분기점 | Skeleton·MiniTimeGrid·시트·셀 모션 전부 (현재 0건 응답) |
| **W0-8** | `tokens.ts`에 `overlay` 토큰 추가 | backdrop `rgba(0,0,0,0.4)`류 하드코딩 2곳+의 토큰화. **DESIGN.md §15 변경 절차 필요 — 사용자 승인 1건** | ConfirmSlotSheet·PlaceActionSheet backdrop |
| **W0-9** | `src/lib/i18n/messages.ts` 시드 | 자주 쓰는 피드백 카피를 §17.6 톤으로 상수화("요청 보냈어요!", "불러오지 못했어요. 다시 시도해볼게요." 등). ko-kr 룰의 i18n-ready 패턴. Q-B12 closure 시 이 파일만 수정 | '~했습니다'/'확인/취소' 톤 혼재, raw e.message 노출 |

**Skeleton.tsx(기존 WIP) 마감**: 700ms 하드코딩→`duration.long`+opacity 0.6↔1(§11.1), reduce-motion 정적 고정. W0-7과 함께 처리.

---

## 4. Wave 1 — P0: 출시 차단급 (~2일)

### 4.1 핵심 여정 3모먼트 (Gate 경로의 클라이맥스가 전부 시스템 Alert)

| ID | 모먼트 | 현재 | 개선 |
|---|---|---|---|
| **W1-1** | **모임 확정** (`app/group/[id]/index.tsx:228-234`) | `Alert.alert` 성공 통지 | Alert 제거 → ConfirmedTimeCard가 duration-long+easing-emphasized로 **등장하는 것 자체가 피드백**(§6.5 "시간 확정 카드 등장") + success 토스트 보조. 확정 실패는 ConfirmSlotSheet 내 인라인 에러로 시트 유지(재시도 보존) |
| **W1-2** | **장소 확정 확인** (`app/group/[id]/place-search.tsx:52-62`, `midpoint.tsx` 동일 패턴) | `Alert.alert('~으로 정할까요?', 취소/확정)` — Gate #1 신호 순간이 시스템 알럿 | W0-3 ConfirmSheet로 교체: 장소명 title-3 + 주소 body-sm + [다음에 정할게요/이곳으로 확정] 페어. `usePlaceConfirmAction` 로직·idempotency 불변 |
| **W1-3** | **"예약하기" 성공** (`app/group/[id]/place.tsx:70`) | `Alert.alert('알림', '식당에 알릴 준비가 됐어요...')` — **Gate #2 측정의 바로 그 순간** | success 토스트(아이콘+§17.6 카피) 또는 시트 내 success 상태 전환(emphasized). `logReservationClick` 호출·1회성 불변. 카피는 Q-B12 대기 문구 유지 |

### 4.2 Alert 전면 철거 (48곳 → 0)

- **W1-4**: 성공/안내 피드백(친구 요청·수락·차단 완료·초대 결과·자동 합류 등) → W0-2 토스트. 자동 합류(`app/_layout.tsx:192-201`)는 "모임에 합류했어요!" + "보러 가기" 액션 토스트.
- **W1-5**: 확인 절차(로그아웃·차단·everytime 이탈 등) → W0-3 ConfirmSheet. **로그아웃은 현재 confirm 없이 즉시 실행**(`profile.tsx:62-65`) — 시트 필수.
- **W1-6**: 폼/전제 조건 경고(everytime 학기 미입력 등) → 인라인 에러(§11.3 표). raw `e.message` 노출 전부 `messages.ts` 매핑으로 (FirstTimeModal의 `mapErrorToKorean` 패턴 전역화).
- 예외: OS 권한 요청 등 시스템 경계는 시스템 UI 유지.

### 4.3 상태 디자인 정상화 (에러 위장 해제 + 로딩 일관화)

| ID | 대상 | 문제 → 개선 |
|---|---|---|
| **W1-7** | 홈 (`(tabs)/index.tsx:32-34`) | fetch 실패가 "잡힌 모임이 아직 없어요" 빈 상태로 **위장** → error 분리 + EmptyState error variant(재시도). **+ useFocusEffect refetch**(모임 생성 후 복귀 시 미갱신) + RefreshControl |
| **W1-8** | 친구 목록 (`friends/index.tsx:38-44,216`) | 동일 위장 + 첫 로딩 완전 빈 화면 → error 분리 + FriendCard 모양 Skeleton 3~4장 |
| **W1-9** | 지도 탭 (`(tabs)/map.tsx:65-101`) | 타이핑마다 전체 스피너 점멸 + **결과 카드가 탭 불가능한 죽은 View** → 이전 결과 유지+첫 로드만 Skeleton, 카드 Pressable화(place-search 카드 패턴 재사용, PlaceActionSheet 연결) |
| **W1-10** | 모임 상세·초대·place (`group/[id]/index.tsx:120-121`, `invite.tsx:223-226`, `place.tsx:89-107`) | raw error 한 줄·막다른 화면 → EmptyState error variant + 재시도. place.tsx 로딩 텍스트 → Skeleton |

### 4.4 첫인상·신뢰 결함 (각 S~M)

| ID | 항목 | 근거 |
|---|---|---|
| **W1-11** | 스플래시 게이트: 다크에서 흰 화면 flash → surface-0 배경 + BrandMark + Spinner | `app/index.tsx:19-30`, §17.4 |
| **W1-12** | privacy 뒤로가기가 **오른쪽 화살표**로 렌더 → Icon '뒤로' (W0-5 적용 시 자연 해소) | `(auth)/privacy.tsx:44` |
| **W1-13** | 약관 전문 화면 부재 — chevron 어포던스가 배신, 동의 대상 문서 열람 불가(법적 리스크) → 행 탭=토글 유지, chevron 별도 Pressable로 전문 화면 push (privacy.tsx 섹션 컴포넌트 재사용) | `(auth)/terms.tsx:117-151` |
| **W1-14** | 회원 탈퇴 진입점 전무 → '관리' 섹션 SettingRow + 2단 ConfirmSheet. 서버 삭제 RPC 필요(백엔드 포함 L — 스토어 심사 요건이므로 P0) | `(tabs)/profile.tsx` |
| **W1-15** | 검색 화면 '카톡으로 친구 초대' 카드 no-op → `useKakaoInvite` 훅 추출해 연결 | `friends/search.tsx:181-184` |

---

## 5. Wave 2 — P1: 완성도 (~2.5일)

### 5.1 셸·네비게이션

- **W2-1** 탭바: iOS 홈 인디케이터 safe area 반영(`useSafeAreaInsets`), 아이콘 22→24, focused 시 fill 2중 신호. (`(tabs)/_layout.tsx`)
- **W2-2** 다크 네비 배경: Stack `contentStyle.backgroundColor=surface-0` (root+group+schedule) — 전환 시 라이트 배경 노출 제거. 루트 Stack `slide_from_right` 통일.
- **W2-3** **중앙 FAB** (§10.7 — IA 명세인데 현재 부재): 56pt radius-md brand-500 e4, 탭바 위 16pt notch, press scale 0.96. **글리프는 §14 D-FAB 미해결** → 옵션 ①Lucide `calendar-days`+`plus` 코드 합성(MapMarkerView처럼 뷰 합성, 자산 0) ②자산 확정까지 FAB 보류. **사용자 결정 1건**.
- **W2-4** ScreenHeader 10개 화면 일괄 적용 (W0-5 후속 기계적 치환).

### 5.2 시간 그리드 (핵심 화면 — D12 worklet 불가침, 시각 레이어만)

- **W2-5** 그리드 헤더에 **요일 표기** 2줄(요일 caption + 날짜 micro tabular-nums, luxon KST). 현재 '7/8' 숫자만.
- **W2-6** 히트맵 셀 색 전환 모션: broadcast 경로(React.memo+JS state)에 withTiming(short), **heat-4 진입만 xLong+emphasized(축하 모먼트)**. reduce-motion 시 micro. — 드래그 worklet 경로 무접촉.
- **W2-7** 셀 a11y 라벨에 날짜·시간·인원 주입("7월 8일 수요일 19시 30분, 3명 가능" §12.3), 모임 상세 RefreshControl(호스트 확정을 멤버가 못 보는 stale 탈출구), RealtimeStatus 카피('30s'·'폴링' 제거), ConfirmedTimeCard 위계 3단계(check 아이콘+시간 title-3 tabular-nums)+다크 배경 보정.

### 5.3 화면 마감

- **W2-8** pressed 피드백 전면 전환: opacity → 카드/행 surface-3, brand fill은 brand-600 (W0-1 Button 적용 + 잔여 Pressable sweep).
- **W2-9** 홈: 통계 칩 실데이터(이번 달 모임 luxon 파생, 미연결 칩은 숨김 — 가짜 '0' 금지 §17.2)+숫자 title-2 tabular-nums 격상, 모임 카드 위계(chevron+상태 dot·라벨 페어+날짜 요약), 빈 상태 CTA 추가, 알림 벨 처리(**사용자 결정: 제거 vs '준비 중' 토스트**).
- **W2-10** 친구: in-flight 잠금(더블탭 중복 요청 방지), 요청함·검색 pull-to-refresh, 빈 상태 CTA 2곳, 배지 카운트에 모임 초대 합산, FriendCard '최근 모임 0회' 제거(항상 undefined인 필드).
- **W2-11** 캘린더 연결 SettingRow(끊김 시 error-fg+아이콘, 탭→ReauthModal 재사용) — '나중에' 닫으면 재연결 경로 소실 해소. + 이용약관·개인정보 링크 SettingRow.
- **W2-12** group/new 마감: **KeyboardAvoidingView**(이름 입력 시 하단 CTA 가림), atMax에서 새 날짜 탭 시 무반응 → 힌트 워블 또는 토스트 1회, 생성 실패 raw message 매핑, CTA radius `lg`→`md` 통일.
- **W2-13** 검색 입력 3곳(친구·지도·place-search) 공용 SearchField: clear(X) 버튼, returnKeyType="search", a11y 라벨.
- **W2-14** 카피 톤 전면 통일: '~했습니다'→'~했어요', '확인/취소'→행동 서술형('다음에 정할게요' 등), 영문 잔재('Google', '30s'), MapPlaceholder 내부 용어("정식 앱 빌드") 제거 → messages.ts 수렴 (§17.6·§17.7).
- **W2-15** PlaceActionSheet §10.3 정합: CTA 높이 48→56, backdrop overlay 토큰, 등장 모션 스펙화. ConfirmSlotSheet → W0-3 골격으로 이관(grabber+radius-2xl).

---

## 6. Wave 3 — P2: 디테일 (~1.5일, 시간 허용 시)

- **W3-1** 타입 스케일 이탈 정리: 온보딩 26pt→display, 임의 lineHeight/letterSpacing 오버라이드 제거 (auth 5곳, 홈 5곳 등).
- **W3-2** 간격 리터럴 sweep: `marginTop: 2/4`, `paddingVertical: 5/6` → space 토큰 (프로필·지도·캘린더 weekdayHead 등).
- **W3-3** 터치 타깃 미달 2곳(홈 '지도로 보기' 34pt, 친구 요청 버튼 36pt) hitSlop 보정. tabular-nums 누락(멤버 수 카운터).
- **W3-4** 다크모드 개별 보정: 홈 CTA rgba 흰색 하드코딩→on-brand 토큰, ConfirmedTimeCard(W2-7에 포함), privacy 테이블 헤더 surface-2, 로그인 히트램프 heat-0 비가시(border-subtle hairline), NaverMapScene 캡션 halo.
- **W3-5** 모션 마감: 온보딩 dot 스냅→short 트랜지션, 슬라이드 3 확정 모먼트 1회 모션, CalendarDatePicker 월 전환 fade, 친구 탭 인디케이터 translateX, MiniTimeGrid reduce-motion 응답.
- **W3-6** MapMarkerView order 배지 §10.5 정합(28→32pt, 숫자 title-3), 지도 탭 MapHost 구조 통일(D38 이점 공유).

---

## 7. 검증 계획

- **TDD**: 프리미티브 6종 각각 테스트 선행(디자인 스펙 단위 — disabled 색, 토스트 등장/자동 소멸, 시트 backdrop 닫기, reduce-motion 분기). 기존 Jest 1000+ 회귀 그린 유지.
- **웨이브 게이트**: 각 wave 종료 시 ①`npm test`+typecheck 0+eslint 0 ②design-guard CRITICAL 4 ③`/design-check` §17.7 체크리스트 ④에뮬레이터 라이트/다크 스크린샷 대조(`/run-denda`).
- **정량 완료 조건**: `Alert.alert` 프로덕션 0곳(시스템 경계 제외) · `ActivityIndicator` 0곳 · `isReduceMotionEnabled` 분기 전 모션 컴포넌트 적용 · 빈/에러 상태 전부 §11.2 3요소.
- **회귀 경계**: TimeGrid 드래그 worklet 경로 diff 0 (D12). Gate #2 클릭 로깅 1회성 테스트 유지.

## 8. 스코프 제외

- 🔒 Phase 3 전부 (예약/결제/식당 UI).
- §14 디자인 **자산** 트랙: 빈 상태 일러스트 5종(D-EMPTY-ART), 브랜드 마크 정식 SVG, 온보딩 모션 캡처(D-ONBOARD-MOTION) — 코드가 아닌 산출물. 본 플랜은 자산 없이 토큰 내 처리(아이콘 원형 등)로 마감하고, 자산 도착 시 교체 seam만 남긴다.
- 다크모드 수동 토글(P1 차기, D6), i18n 영문(차기).
- 네이버 지도 실렌더 관련 운영 트랙(키 발급·EAS)은 기존 NOW.md 트랙 그대로.

## 9. 리스크 · 사용자 결정 (✅ 4건 확정 2026-07-08)

| # | 결정 | 확정 |
|---|---|---|
| 스코프 | 이번 실행 범위 | ✅ **Wave 0~2** (프리미티브 + P0 출시차단급 + P1 완성도). Wave 3은 시간 허용 시 후속 |
| R1 | **FAB 글리프** (W2-3, §14 D-FAB 미해결) | ✅ **① Lucide 합성 뷰 즉시 추가** — calendar-days+plus 코드 합성(MapMarkerView/D40 선례, PNG 0). §14 D-FAB는 이 합성으로 closure |
| R2 | **홈 알림 벨** (W2-9) | ✅ **① 제거** — 토스 풍 절제 + §17 anti-AI-feel. 알림함은 차기 버전 |
| W1-14 | **회원 탈퇴** (스토어 요건) | ✅ **풀 구현** — 프론트 2단 ConfirmSheet + Supabase 서버 삭제 RPC/Edge (RLS·cascade 포함, @reviewer 강화 리뷰) |
| W0-8 | `overlay` 토큰 추가 | ✅ 승인 — DESIGN §13 tokens.ts 추가 + §16 결정 로그 기록(§15 절차) |

공수 총계(솔로+AI 기준): **Wave 0+1 ≈ 3.5일 (출시 필수) / +Wave 2 ≈ 6일 (← 확정 스코프) / +Wave 3 ≈ 7.5일**.

## 10. 실행 방식

승인 후 TASK_BACKLOG에 `UI-W0-*`~`UI-W3-*`로 등록 → `/start-task`(TDD 강제) → 웨이브별 `/ship-task`. 각 wave는 독립 커밋 단위(프리미티브 1커밋, 화면 전환은 화면군 단위).
