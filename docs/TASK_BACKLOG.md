# Task Backlog — Phase 1+2 (β-compact)

> Phase 1+2 모바일 출시까지의 모든 빌드 태스크. 새 태스크는 lane 안에 추가. 완료 시 → [SESSION_LOG.md](SESSION_LOG.md)에 기록 + 이 파일에서 Status: DONE.
> 출처: ENG_REVIEW §9 (17단계, 4 lanes, Sprint 0~4) + D2 (OCR · 지도-일정 mode keep) + D1 W1 deadline gate
> 타임라인: 3.5주 (Sprint 0~4 + W3.5 QA)

---

## 진행 현황 요약

- **총 17 태스크** (S00 ~ S16)
- **DONE**: 1 (S00)
- **IN_PROGRESS**: 0
- **TODO**: 15
- **BLOCKED**: 1 (S10 — D1 지도 부분 답변 대기. S01은 D29 채택으로 unblocked)

상세 burn-down은 [PROGRESS.md](PROGRESS.md) 참조.

---

## Sprint 마일스톤

| Sprint | 기간 | 핵심 deliverable | Gate |
|---|---|---|---|
| **Sprint 0** | W-1 | §10 dev infra 12 항목 + Kakao 정책 문의 발송 + 디자인 자산 (FAB·로고·마커) | Infra readiness |
| **Sprint 1** | W0 | S00 backend foundation, S11 다크 토큰, S13 EAS skeleton | Foundation ready |
| **Sprint 2** | W1 | S01 (auth, D29 OIDC) + S10 (map) + S14 (web guest) 병행 시작. Attribution 자체 구축 PoC | **★ W1 deadline: Kakao Local API 답변 review (auth는 D29로 해소). No-answer → NaverSearchProvider eager 활성** |
| **Sprint 3** | W2 | S05 (time grid) + S08 (friends) + S03 (OCR) Lane A worktree 3개 병행. S10 continuation. S14 continuation | Baseline 측정 시작 |
| **Sprint 4** | W3 | S04 (confirm) + S06 (calendar sync) + S12 (push F1-F3). S15 (지도-일정 mode). S14 → S15 (Branch.io 통합) | TestFlight Internal 시작 |
| **W3.5** | W3.5 | S17 QA 종합 + 안암 invite-only | Launch |

---

## Lane A — Foundation · Auth · Time Grid · OCR

### S00 — Backend Foundation (Supabase project + DB schema + RLS)

- **Status**: DONE (2026-05-22) | **Owner**: Backend | **Sprint**: 1 | **Lane**: A
- **Depends**: D3 (partnerships only schema), D14 (15분 슬롯 CHECK), D16 (차단 helper)
- **Acceptance**:
  - 새 Supabase project 생성
  - 다음 tables: `users`, `friendships`, `friend_requests`, `groups`, `group_members`, `group_guests`, `group_invitations`, `votes`, `time_slots`, `places`, `partnerships`, `schedules`, `comments`, `push_tokens`, `notification_settings`, `reports`, `blocks`, `branch_attributions`
  - `votes.start_minute % 15 = 0` CHECK
  - `groups.confirmed_place_id` (FK to places, nullable)
  - `groups.f4_sent_at` (timestamp nullable — D17)
  - `places.partnership_id` (FK to partnerships, nullable)
  - RLS policy skeleton + `is_blocked(viewer, target)` helper
  - Edge Function scaffolding
- **Files**: `supabase/migrations/0001_initial.sql`, `supabase/functions/_lib/`
- **Worktree 분기**: 불가 (모든 후속 태스크 의존)

### S01 — Kakao OIDC OAuth (Supabase signInWithIdToken)

- **Status**: TODO | **Owner**: Backend + Mobile | **Sprint**: 2 | **Lane**: A
- **Depends**: S00 (auth.users + on_auth_user_created trigger), [D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede), Sprint 0 §10 (카카오 portal OIDC 활성화 + Supabase Auth dashboard Kakao provider Enable)
- **Acceptance**:
  - `@mj-studio/react-native-kakao` (또는 `@react-native-seoul/kakao-login`) 통합. Sprint 0 PoC 결과로 패키지 확정
  - OIDC login flow with `scope=['openid', 'profile_nickname']` + cryptographically random nonce (`expo-crypto::randomUUID()`)
  - `supabase.auth.signInWithIdToken({ provider: 'kakao', token: response.idToken, nonce })` 호출
  - 약관·개인정보 동의 모달 (V2_PRD §5.1)
  - 3-슬라이드 온보딩
  - 재로그인 = Supabase가 자동 매칭 (provider_id = id_token.sub). Token refresh = Supabase 자동 (client SecureStore via `expo-secure-store`)
  - `AuthProvider` interface 추상화 (S16 Apple ID fallback 대비)
  - `public.users` 동기화 = `on_auth_user_created` Postgres trigger (migration 0003에서 재작성)
- **Files**: `src/lib/auth/AuthProvider.ts`, `src/lib/auth/KakaoOIDCProvider.ts`, `src/screens/onboarding/`
- **Worktree 분기**: 가능 (S03 OCR + S07 친구는 S01과 병행 worktree 가능)
- **Notes**: ARCHITECTURE.md §3.1 (D29 flow 다이어그램) 참조. 삭제 완료된 코드 — `supabase/functions/kakao_login/`, `_lib/hmac.ts::syntheticEmail`, `users.synthetic_email` (migration 0003)

### S02 — Web Guest Page Sketch (별도 codebase 시작 — Sprint 2)

(Lane C로 이동 — S14 참조)

### S03 — 에브리타임 OCR (Gemini Vision)

- **Status**: TODO | **Owner**: Backend + Mobile | **Sprint**: 3 | **Lane**: A
- **Depends**: S00 (schedules table), S01 (auth)
- **Acceptance**:
  - Gemini Vision API client
  - 학교 시간표 OCR Edge Function (`/ocr/everytime`)
  - 학기 시작·종료일 입력 모달
  - 매주 반복 일정 자동 INSERT to schedules (source = 'everytime')
  - 학기 종료 자동 만료
  - 미리보기·confirm step
  - Ground truth eval set ~20장 (TEST_PLAN.md 참조)
  - **OCR 일정은 외부 캘린더 push 안 함** (D2 / ENG_REVIEW §9.4)
- **Files**: `src/screens/schedule/everytime/`, `supabase/functions/ocr_everytime/`, `tests/ocr/ground_truth/`
- **Worktree 분기**: 가능 (S05·S07과 병행)
- **Notes**: D2에서 founder가 OCR keep 결정. P1 학생 segment 가치 + 학기 시작 timing critical

### S04 — 모임 확정 + 멤버 푸시 (F5)

- **Status**: TODO | **Owner**: Backend + Mobile | **Sprint**: 4 | **Lane**: A
- **Depends**: S05 (votes), S00 (groups.confirmed_at, f4_sent_at)
- **Acceptance**:
  - 호스트 권한 체크 (RLS + UI gate)
  - "확정" 더블 탭 idempotency (D17 f4_sent_at 활용 또는 별도 lock)
  - F5 push Edge Function (전원 발송 + partial fail report — D19)
  - Push fan-out background queue (D20)
  - 단일 dispatcher (Q-B5 결정 후) → Calendar push(S06) + Push 알림(S12) 둘 다 듣지 않도록
- **Files**: `src/screens/group/[id]/confirm.tsx`, `supabase/functions/group_confirm/`
- **Worktree 분기**: S06, S12와 logical 의존 — 합류 시점 조율

### S05 — 시간 그리드 + 투표 + Realtime 히트맵

- **Status**: TODO | **Owner**: Mobile + Backend | **Sprint**: 3 | **Lane**: A
- **Depends**: S00 (votes, time_slots, Realtime enabled), D9 (8pt/44pt), D10 (heat ramp), D11 (Edge aggregation), D12 (60fps spec)
- **Acceptance**:
  - Reanimated worklet drag (UI thread)
  - FlashList 또는 React.memo 셀 가상화 (60slot × 7day = 420 cells)
  - `useSharedValue` 셀 상태 (JS state X)
  - Drag sweep 멀티셀렉트 (single tap = 1슬롯 toggle)
  - 09:00·24:00 경계 처리
  - 다일 (multi-day) span 처리
  - Vote commit 1회 + 100ms debounce
  - Edge Function `on_votes_change`: votes 합산 → `broadcast` channel
  - Client receive → `useSharedValue` 업데이트 → 셀 색 transition (heat-0~4)
  - Realtime disconnect UI (Q-B6 → DESIGN §11.4 info-bg 칩)
  - 60fps 부하 테스트: 7명 모임 동시 투표 (저사양: iPhone SE 2, Galaxy A14)
- **Files**: `src/screens/group/[id]/grid.tsx`, `src/components/TimeGrid/`, `supabase/functions/votes_aggregate/`
- **Worktree 분기**: 가능 (S03 OCR, S07 친구와 worktree 병행)
- **Notes**: 7.3 ASCII flow 참조. **회사 운명이 60fps에 걸린 부분 (ENG_REVIEW §1.4)**

### S07 — 친구 시스템 + 신고/차단

- **Status**: TODO | **Owner**: Mobile + Backend | **Sprint**: 3 | **Lane**: A
- **Depends**: S00 (friendships, blocks, reports), D16 (helper function)
- **Acceptance**:
  - 친구 요청·수락·해제 + RLS
  - 친구 탭 UI
  - `is_blocked(viewer, target)` helper 적용한 SELECT (검색·추천·모임 멤버·초대)
  - 차단된 사용자가 만든 모임 초대 = hidden 또는 "차단된 사용자로부터" 라벨
  - 신고 UI + 운영팀 카톡 채널 통지 (manual)
- **Files**: `src/screens/friends/`, `supabase/functions/_lib/blocking.ts`
- **Worktree 분기**: 가능

---

## Lane B — Map · Click-through · 지도-일정 mode

### S10 — 지도 + 카카오 Local API

- **Status**: BLOCKED (Q-A2) | **Owner**: Mobile + Backend | **Sprint**: 2 | **Lane**: B
- **Depends**: S00 (places, partnerships), D1 W1 deadline, D18 (좌표 정규화), D26 (debounce + cache)
- **Acceptance**:
  - `@mj-studio/react-native-naver-map` 통합
  - 카카오 Local API client (`coords/normalize.ts` 통과, WGS84 명시)
  - 카테고리 필터 + 반경 조절
  - Viewport 이동 300-500ms debounce + 5분 격자 캐싱
  - 클러스터링 (네이버 SDK API 검증 → 없으면 `react-native-supercluster`)
  - 제휴 마커 강조 (PNG 1.5x/2x/3x — Q-B13)
  - Rate limit fallback ("잠시 후 다시")
  - `PlaceSearchProvider` interface 추상화 (S16 fallback 대비)
- **Files**: `src/screens/map/`, `src/lib/places/KakaoLocalProvider.ts`, `src/lib/places/PlaceSearchProvider.ts`, `src/lib/coords/normalize.ts`
- **Worktree 분기**: 가능 (Lane A와 독립)

### S08 — "예약하기" Click-through 측정

- **Status**: TODO | **Owner**: Mobile + Backend | **Sprint**: 3 | **Lane**: B
- **Depends**: S10 (마커 인터랙션), Q-A4 (baseline 측정 design)
- **Acceptance**:
  - 마커 탭 → 바텀시트 (DESIGN §10.3)
  - "예약하기" 버튼: click event 로깅 (idempotent — 더블 탭 1 event)
  - "장소만 정하기" 버튼: 카톡 공유
  - "Phase 1+2: 준비 중" 안내 또는 silent (founder 선택)
  - Click 이벤트 schema: `event_id`, `user_id`, `group_id`, `place_id`, `partnership_id`, `clicked_at`, `segment_label` (P1/P2)
  - **Gate #2 측정의 단일 source of truth** (G2 참조)
- **Files**: `src/screens/group/[id]/place.tsx`, `src/lib/analytics/click_through.ts`, `supabase/functions/click_log/`

### S15 — "지도로 내 일정 보기" 모드

- **Status**: TODO | **Owner**: Mobile | **Sprint**: 4 | **Lane**: B
- **Depends**: S10 (지도 + 마커), S00 (schedules, groups)
- **Acceptance**:
  - 캘린더에서 토글 진입
  - `<MapView mode="search" | "schedule">` 분기 (mode 전환 시 마커 set 교체 + 폴리라인 toggle)
  - 모임 일정 좌표 표시 (Google·Apple 일정 좌표 차기 — Q-C6)
  - 시간순 ①②③ 숫자 배지 (DESIGN §10.5)
  - 보라 #7C3AED 점선 폴리라인
  - 5+ 마커 자동 숨김 (가장 가까운 두 점만)
  - 시간 범위 선택
- **Files**: `src/screens/map/schedule_mode.tsx`
- **Notes**: D2에서 founder가 keep. P5 (B standalone 외부 확장) 검증 가치

---

## Lane C — Web Guest

### S14 — Web Guest Page (Next.js)

- **Status**: TODO | **Owner**: Web | **Sprint**: 2-3 | **Lane**: C
- **Depends**: S00 (group_guests, votes — SQL 직접 또는 별도 API), D23 (Next.js 별도 codebase), S05 (시간 그리드 spec 공유)
- **Acceptance**:
  - Vercel project 셋업
  - 게스트 토큰 생성 (Q-B7 — 모임별 별도)
  - 닉네임 입력 → group_guests INSERT
  - 시간 그리드 (RN과 별도 구현, 같은 동작 spec) — Conflict flag: D23 spec drift 주의
  - Branch.io 단축 URL 생성
  - 카톡 OG 메타 (`og:title`, `og:image`, `og:description`)
  - 모바일·태블릿 only (DESIGN §12.7, 데스크톱 폭 미지원)
  - 투표 완료 → "결과 알림 받으려면 →" CTA
- **Files**: `web-guest/` (별도 git repo 또는 monorepo subdir — founder 선택)
- **Worktree 분기**: 완전 독립 (별도 codebase)

### S15 — 자체 deferred deep link (게스트→회원 전환) — D28

- **Status**: TODO | **Owner**: Backend + Mobile + Web | **Sprint**: 4 | **Lane**: C → A 합류
- **Depends**: S01 (auth complete), S14 (guest page complete + Vercel hosting), Q-A6 (자체 구축 정확도 PoC), [D28](DECISIONS.md#d28--자체-deferred-deep-link-구축-attribution-saas-회피-도메인-구매-회피)
- **Acceptance**:
  - 단축 URL host = `denda.vercel.app/g/<short_token>` (Vercel default subdomain)
  - **iOS Universal Links**: app.json `associatedDomains: ["applinks:denda.vercel.app"]` + AASA 파일 Vercel hosting (`public/.well-known/apple-app-site-association`)
  - **Android App Links**: app.json intent filters (scheme=https, host=denda.vercel.app, pathPattern=/g/.*) + assetlinks.json Vercel hosting (`public/.well-known/assetlinks.json`)
  - **Fingerprint 매칭 Edge Function**: 단축 URL 클릭 시 ip_hash + ua_hash + clicked_at 기록 → 앱 첫 실행 시 매칭 query
  - **4자리 invite_code fallback**: groups에 invite_code (CHAR(4) numeric) 추가. 모든 게스트 카톡 메시지에 표시. 앱 첫 화면 "초대받은 모임 코드 입력" 모달 강제 (Universal Link + fingerprint 둘 다 miss 시)
  - **ATT 모달** (iOS 14+) + 한국 PIPA 처리방침 명시
  - **`branch_attributions` 확장**: ip_hash, ua_hash, clicked_at 컬럼 추가 (table 이름 유지 — schema 변경 cost ↓)
  - `group_guests.converted_user_id` 설정 (또는 group_members 마이그레이션)
  - 모임 자동 합류 + 모임 list에 표시
  - Q-A6 PoC 결과 정확도 측정 — <70% 시 fallback 의무 활성 default ON
- **Files**: `src/lib/attribution/`, `supabase/functions/attribution_match/`, `web-guest/pages/g/[token].tsx`, `web-guest/public/.well-known/apple-app-site-association`, `web-guest/public/.well-known/assetlinks.json`
- **Notes**: ARCHITECTURE.md §3.5 자체 구축 spec 참조. Sprint 4 일정 1-2주 추가 가능성 — S05 (회사 운명 60fps) critical path 보호 priority. table·column "branch_" prefix는 의미적으로 generic. Phase 3 광고 launch 시 SKAdNetwork 미지원으로 SaaS 추가 도입 필요 (D28 명시 risk)

---

## Lane D — Cross-cutting

### S06 — Calendar Sync (Google + Apple)

- **Status**: TODO | **Owner**: Mobile + Backend | **Sprint**: 4 | **Lane**: D
- **Depends**: S04 (모임 확정 trigger), D15 (apple_ios 통합 bucket), D19 (단방향 + 부분실패 명시), D20 (background queue)
- **Acceptance**:
  - Google Calendar OAuth + `events.insert` (single event push)
  - `expo-calendar` wrapper (iOS 17+ write-only 권한)
  - "어디 추가할까요" 첫 모달 (Google·Apple·둘 다)
  - Token 만료 → 프로필 "재인증 필요" + 다음 진입 모달
  - Partial push fail 시 호스트에게 멤버 list 알림
  - Background queue (pg_cron + retry max 3)
- **Files**: `src/lib/calendar/google.ts`, `src/lib/calendar/apple.ts`, `supabase/functions/calendar_push/`

### S11 — 다크모드 토큰 셋업 + 디자인 시스템

- **Status**: TODO | **Owner**: Mobile + Design | **Sprint**: 1 | **Lane**: D
- **Depends**: DESIGN.md, D6 (시스템 자동, 독립 디자인)
- **Acceptance**:
  - `src/design/tokens.ts` (라이트/다크 두 세트, DESIGN §13 스켈레톤)
  - `src/design/theme.ts` (Context Provider, `useColorScheme` 통합)
  - `src/design/typography.tsx` (Title/Body/Caption 변형)
  - Pretendard Variable 셀프호스팅 (`expo-font` + WOFF2 — D7)
  - Lucide 아이콘 설치 + 작명 매핑 (DESIGN §9.1)
  - 시스템 자동 ON만 — 수동 토글 X (D6)
  - **다크 디테일 검증 deferred (D2)**: 토큰 정의만, 마커·차트 검증은 Phase 3
- **Files**: `src/design/tokens.ts`, `src/design/theme.ts`, `src/design/typography.tsx`, `assets/fonts/PretendardVariable.woff2`

### S12 — Push Notification F1-F3

- **Status**: TODO | **Owner**: Backend + Mobile | **Sprint**: 4 | **Lane**: D
- **Depends**: S00 (push_tokens), S07 (friends)
- **Acceptance**:
  - Expo push token 등록 (`expo-notifications`)
  - `supabase/functions/notify_f1` (친구 요청)
  - `supabase/functions/notify_f2` (친구 수락)
  - `supabase/functions/notify_f3` (모임 초대)
  - 마이크로카피 (Q-B12 closure 후)
  - F4 idempotency (D17 `f4_sent_at`)
  - F5는 S04에서 (모임 확정 trigger)
  - 단일 dispatcher (Q-B5 결정 후)
- **Files**: `src/lib/push/`, `supabase/functions/notify_*`

### S13 — EAS Build + 인증서 + TestFlight

- **Status**: TODO | **Owner**: Founder + Mobile | **Sprint**: 1 + W3 | **Lane**: D
- **Depends**: Apple Developer + Google Play Console 가입 (Q-B20)
- **Acceptance**:
  - EAS config (`eas.json`)
  - iOS 인증서 + provisioning profile
  - Android keystore
  - TestFlight + Google Play Internal Testing 트랙
  - EAS secret 관리 (Supabase URL, Kakao key, Naver key, Branch.io key 등)
  - Production binary cold start < 2초 측정 (D25)
- **Files**: `eas.json`, `app.json`, `.env.eas`

### S16 — Backup Providers (D1 조건부 lazy)

- **Status**: BLOCKED (D1 답변 대기) | **Owner**: Backend + Mobile | **Sprint**: 2 (interface) + 3 (impl) | **Lane**: D
- **Depends**: D1 W1 deadline review
- **Acceptance — Phase a (interface, 항상)**:
  - `AuthProvider` interface (`KakaoSyntheticAuthProvider` + `AppleAuthProvider` 두 구현 plug-in 가능)
  - `PlaceSearchProvider` interface (`KakaoLocalProvider` + `NaverSearchProvider` 두 구현 plug-in 가능)
- **Acceptance — Phase b (impl, D1 답변 미수신 시만)**:
  - `AppleAuthProvider`: Apple ID OAuth + email 입력 + 약관 모달
  - `NaverSearchProvider`: 네이버 검색 API + 카테고리 데이터 한계 수용
  - W1 deadline 결과에 따라 split lane 가능 (auth만 fallback, map은 keep 등)
- **Files**: `src/lib/auth/AppleAuthProvider.ts`, `src/lib/places/NaverSearchProvider.ts`

### S17 — QA + Regression Test Set

- **Status**: TODO | **Owner**: QA (founder) | **Sprint**: 4 + W3.5 | **Lane**: D
- **Depends**: 모든 step (mature 후)
- **Acceptance**:
  - Test framework (Jest + Maestro + Playwright + Deno) — D24
  - 50+ path test 구현 (TEST_PLAN.md 참조: 32 unit/integration + 15 E2E + 1 regression + OCR eval)
  - Prior MVP 시간 그리드 동작 영상 → 새 코드 side-by-side regression
  - 안암 invite-only 베타 (카톡 viral funnel)
  - TestFlight + Internal Testing 라운드
- **Files**: `tests/`, `e2e/`, `playwright/`, `supabase/functions/_tests/`

---

## Sprint 0 — Pre-build 인프라 체크리스트 (ENG_REVIEW §10)

이 12개는 Sprint 1 시작 전 완료. **태스크 코드 부여 X (인프라 셋업)**.

- [ ] **Kakao Local API 정책 답변 1건** (Q-A2 — D1 W1 deadline) **CRITICAL BLOCKER**. Q-A1 (auth)는 [D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede) closed.
- [ ] **Kakao OIDC + Supabase Auth provider 활성화** ([D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede)) — 카카오 portal: 앱 설정 → 카카오 로그인 → OpenID Connect 활성화 ON + `profile_nickname` 동의항목 필수. Supabase dashboard: Authentication → Providers → Kakao Enable + REST API key. 스모크 테스트로 1회 로그인 → `auth.users` 행 생성 확인
- [x] 새 Supabase project 생성 + RLS skeleton (S00 prep) — schema·RLS·scaffolding 코드 완료 (deploy는 사용자)
- [ ] Naver Map SDK key 발급
- [ ] Kakao Developers app 등록 (Local API key)
- [ ] Google Cloud Console (Gemini API for OCR + Google Calendar API)
- [ ] Branch.io account + Phase 1+2 deep link spec
- [x] Expo 프로젝트 init (SDK 56) — EAS는 S13에서
- [ ] Apple Developer + Google Play Console 가입 (Q-B20) — **W-2 시작** (Apple 심사 buffer)
- [ ] Vercel project (S14 prep)
- [ ] 디자인 자산: FAB 글리프 (Q-B9), 로고 (Q-B10), 제휴 마커 PNG (Q-B13)
- [ ] 개인사업자 등록 (Phase 3 timing 압박 ↓ 위해 미리 시작)
- [ ] 운영팀 카톡 채널 초기 셋업

---

## Worktree Parallelization Notes

Worktree 분기 시 conflict flag (ENG_REVIEW §9.4):
- **S05 (RN 그리드) ↔ S14 (Web 그리드)** — 동작 spec drift 위험. 토큰·behavior spec을 S00과 같은 sprint에 정의 + 두 lane이 share
- **S06 (Calendar) ↔ S12 (Push)** — 둘 다 모임 확정 trigger. 단일 dispatcher pattern (Q-B5)
- **S10 (지도) ↔ S11 (다크 토큰)** — 네이버 SDK `isNightModeEnabled` 통합 시점 명확히. S11이 토큰만, S10에서 적용
- **S03 (OCR) ↔ S06 (Calendar)** — `source = 'everytime'` enum 격리로 충돌 없음. OCR 일정의 외부 캘린더 push 안 함 (D2 + ENG_REVIEW §9.4)
- **S10 (지도 search mode) ↔ S15 (지도 schedule mode)** — `<MapView mode="search"|"schedule">` 분기. S15는 S10 완료 후

---

## 태스크 추가 템플릿

```markdown
### S{NN} — {제목}

- **Status**: TODO | **Owner**: ? | **Sprint**: ? | **Lane**: ?
- **Depends**: (다른 태스크, 결정, 또는 OPEN_QUESTIONS)
- **Acceptance**: (완료 조건)
- **Files**: (예상 변경/생성 파일)
- **Worktree 분기**: 가능/불가
- **Notes**: (특이사항)
```
