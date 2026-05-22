# Architecture — Phase 1+2 (β-compact)

> 된다 앱의 시스템 아키텍처. 데이터 모델·외부 통합·성능 spec.
> 출처: ENG_REVIEW §1·§2·§4·§7 (ASCII 다이어그램 포함)
> 결정 사항은 모두 [DECISIONS.md](DECISIONS.md)에 별도 기록. 본 문서는 그 결정들의 **시스템 그림**.

---

## 1. Phase 1+2 Tech Stack

→ 결정: [D22](DECISIONS.md#d22--phase-12-tech-stack)

**모바일 (RN/Expo)**
- React Native + Expo SDK 53+
- `expo-router`, `zustand` (state), `expo-secure-store` (token)
- `react-native-gesture-handler` + `react-native-reanimated` (시간 그리드 60fps worklet — [D12](DECISIONS.md#d12--60fps-시간-그리드-구현-spec))
- `@mj-studio/react-native-naver-map` (지도)
- `expo-calendar` (iOS 17+ write-only)
- `expo-notifications` (Expo Push)
- `expo-font` + Pretendard Variable 셀프호스팅 ([D7](DECISIONS.md#d7--typography-pretendard-variable-단일-패밀리-셀프호스팅))
- `lucide-react-native` + `react-native-svg`
- Branch SDK (deferred deep link)

**백엔드**
- Supabase (Postgres + Realtime + Edge Functions + Auth + Storage)
- Kakao Local API (장소 검색 — D1 verify-track)
- Google Calendar API (events.insert)
- Gemini Vision API (OCR — [D2](DECISIONS.md#d2--phase-12-scope-reduction-다크-디테일만-reduce) keep)

**Web Guest**
- Next.js + Vercel ([D23](DECISIONS.md#d23--web-guest-page--nextjs-별도-codebase))

**Phase 3 deferred** (현재 NOT in scope):
- Toss Payments SDK
- 통신판매업 신고 / 변호사 약관 / 식당 활성화 인프라

---

## 2. 데이터 모델 (Phase 1+2 schema)

→ 결정: [D3](DECISIONS.md#d3--phase-3-schema-설계-시점-옵션-b--partnerships-only) — `reservations`/`payments`/`payouts`는 Phase 3 진입 시 설계.

| 테이블 | 핵심 컬럼 | 비고 |
|---|---|---|
| `users` | id, kakao_id, synthetic_email, nickname, phone, created_at | [D21](DECISIONS.md#d21--kakao-oauth-synthetic-email--hmac-베타는-카카오-only) synthetic email |
| `friendships` | user_id, friend_id, created_at | |
| `friend_requests` | from_user_id, to_user_id, status, created_at | |
| `groups` | id, host_id, name, dates, **confirmed_at**, **confirmed_place_id (FK places)**, **f4_sent_at (timestamp nullable — D17)** | f4_sent_at = push F4 idempotency |
| `group_members` | group_id, user_id, joined_at | |
| `group_guests` | guest_token, group_id, nickname, **converted_user_id (FK users nullable)**, voted_at | Web 게스트 |
| `group_invitations` | group_id, inviter_id, invitee_id, status | |
| `votes` | id, group_id, user_id, **start_minute**, end_minute, day, created_at. CHECK `start_minute % 15 = 0` ([D14](DECISIONS.md#d14--시간-슬롯-단위-강제-15분--db-check-constraint)) | 15분 단위 슬롯 |
| `time_slots` | (논리적, votes에서 집계) | 슬롯 자체 저장 X — votes만 |
| `places` | id, kakao_place_id, name, lat, lng (WGS84 — [D18](DECISIONS.md#d18--좌표계-정규화-layer)), category, **partnership_id (FK nullable)** | |
| `partnerships` | id, place_id, signed_at, status, contact_kakao_id, communication_log | Phase 1+2 read-only |
| `schedules` | id, user_id, **source** ('manual'\|'google'\|'apple_ios'\|'everytime' — [D15](DECISIONS.md#d15--schedulessource-enum--phase-12은-provider-구분-포기)), title, start_at (TIMESTAMPTZ — [D13](DECISIONS.md#d13--kst-강제-db는-timestamptz-utc)), end_at, recurrence_rule | apple_ios = multi-source bucket |
| `comments` | id, group_id, user_id, content, created_at | 푸시 알림 발송 안 함 (의도적) |
| `push_tokens` | user_id, token, platform, updated_at | |
| `notification_settings` | user_id, f1_enabled, ..., f5_enabled | F6·F7는 Phase 3 |
| `reports` | reporter_id, target_id, reason, created_at | 운영팀 카톡 manual |
| `blocks` | blocker_id, blocked_id, created_at | [D16](DECISIONS.md#d16--차단신고-일관성-helper-function--rls) helper |
| `branch_attributions` | branch_link_id, group_id, guest_token, **converted_user_id**, **converted_at** | 게스트→회원 전환 |

**Phase 3 migration (Gate 통과 시):**
```
groups + reservation_id (FK nullable, 추가)
+ reservations (NEW)
+ payments (NEW)
+ payouts (NEW)
```
→ 3 tables ADD + groups에 1 column ADD = 작은 migration cost ([D3](DECISIONS.md#d3--phase-3-schema-설계-시점-옵션-b--partnerships-only))

---

## 3. 외부 통합 (External Integrations)

### 3.1. Kakao OAuth (synthetic email + HMAC) — [D21](DECISIONS.md#d21--kakao-oauth-synthetic-email--hmac-베타는-카카오-only)

→ 의존: [Q-A1](OPEN_QUESTIONS.md#q-a1--kakao-비즈앱-우회-oauth-정책-답변) (D1 W1 deadline)

```
[클라이언트 카카오 로그인]
    │
    ▼
카카오 SDK → access_token + user_info (id, nickname, profile_image)
    │
    │   ※ "이메일" 권한 비즈앱만 — 일반 앱 사용 불가
    ▼
백엔드 (Supabase Edge Function)
    │
    ├── access_token 검증 (카카오 /v2/user/me)
    ├── id (Kakao 고유 ID) 추출
    └── synthetic email 생성:
        ├── email = f"kakao_{id}@denda.synthetic"
        └── HMAC(secret, id) = signature (검증용)
    │
    ▼
Supabase Auth signUp({ email: synthetic, password: HMAC })
    │   ※ 일반 user처럼 동작, 그러나 외부 발송 불가
    ▼
앱 사용

정책 risk:
  - Kakao "이메일 없는 OAuth"는 비즈앱 한정.
  - synthetic email은 카카오 정책 위반 아님 (이메일 권한 요청 X)
  - Apple 심사: Apple ID 로그인 동등 제공 강제 (App Store guideline 4.8)
    → 베타는 카카오 only로 시작 + 정식 출시 시 Apple ID 추가
```

**Fallback (D1 답변 미수신 시):** `AppleAuthProvider` eager 활성 (S16). `AuthProvider` interface 추상화 미리 ([S01 acceptance](TASK_BACKLOG.md#s01--kakao-oauth-synthetic-email--hmac)).

### 3.2. Kakao Local API (장소 검색)

→ 의존: [Q-A2](OPEN_QUESTIONS.md#q-a2--kakao-local-api-약관-외부-지도-sdk-위-표시) (D1)

- 모든 호출에 `?x={lng}&y={lat}` (WGS84) 명시 — [D18](DECISIONS.md#d18--좌표계-정규화-layer)
- `coords/normalize.ts` 단일 진입점 통과
- Viewport 이동 300-500ms debounce + 5분 격자 캐싱 (client-side) — [D26](DECISIONS.md#d26--kakao-local-api-quota-client-debounce--viewport-cache)
- Server proxy는 Phase 1+2 미도입 ([Q-B8](OPEN_QUESTIONS.md#q-b8--카카오-local-api-server-proxy-도입-여부))
- Quota: 30만 호출/일 무료. 베타 1000 DAU × 평균 10회 viewport = 10000 호출/일 < 한도. Burst risk only

### 3.3. Naver Maps SDK

- `@mj-studio/react-native-naver-map`
- WGS84 좌표 그대로 사용
- 마커: 제휴 마커는 PNG (네이버 SDK SVG 불가 — [D8](DECISIONS.md#d8--아이콘--lucide--6-커스텀)). 1.4x size (비제휴 대비)
- 클러스터링: SDK API 확인 → 없으면 `react-native-supercluster` Layer 1
- `isNightModeEnabled` 통합 (S11 → S10에서 적용)

### 3.4. Calendar Sync (단방향) — [D19](DECISIONS.md#d19--calendar-sync-단방향-부분-실패-명시)

- **Google Calendar**: OAuth + `events.insert` (single event push)
- **Apple Calendar**: `expo-calendar` (iOS 17+ write-only 권한 only). iOS 디바이스의 모든 캘린더 통합 (iCloud + Google iOS + Outlook + 네이버 iOS) — Phase 1+2은 provider 구분 포기 ([D15](DECISIONS.md#d15--schedulessource-enum--phase-12은-provider-구분-포기))
- 외부 수정/삭제 동기화 X — UI에서 명시
- Token 만료: silent fail 금지. 프로필 → 캘린더 연결 관리에 "재인증 필요" + 다음 진입 모달
- Partial push fail (10명 중 3명): 호스트에게 "일부 멤버 추가 실패" + 멤버 list
- Background queue (pg_cron + retry max 3) — [D20](DECISIONS.md#d20--calendar-push-fan-out--background-queue)

### 3.5. Branch.io (게스트→회원 attribution)

→ PoC: [Q-A6](OPEN_QUESTIONS.md#q-a6--branchio-한국-nat-attribution-정확도-poc) (W1 병렬)

```
W0 - 카톡 모임 초대 링크 (Branch.io 단축 URL)
    │
    ▼
사용자 브라우저 클릭 → 웹 게스트 페이지 (Vercel)
    │
    ├── localStorage: guest_token = UUID
    ├── DB INSERT: group_guests (guest_token, group_id, nickname)
    └── Branch.io: track_event('guest_voted', { guest_token, group_id })
    │
    ▼
투표 완료 → "결과 알림 받으려면 →" CTA
    │
    ▼
Branch.io 링크 → App Store / Play Store
    │
    │  (앱 설치, install + open)
    ▼
W0+δ - 앱 첫 실행
    │
    ▼
Branch SDK init → getLatestReferringParams()
    │
    └── { guest_token, group_id, ... }
    │
    ▼
카카오 OAuth → user_id 확보
    │
    ▼
DB UPDATE: branch_attributions
SET converted_user_id = X, converted_at = NOW()
WHERE branch_link_id = ...
    │
    └── group_guests → group_members 마이그레이션
        (또는 둘 다 유지하고 group_guests.converted_user_id 설정)
    │
    ▼
모임 자동 합류 + 모임 list에 표시

⚠️ Attribution miss (한국 NAT 환경 정확도 < 70% 가능):
  - 카톡 인앱 브라우저 → 외부 브라우저 → App Store install
  - IP 매칭 실패, Branch.io fingerprint matching도 실패
  → fallback: 앱 내 "초대받은 모임 코드 입력" 수동 입력
```

### 3.6. Expo Push Notifications

- F1 (친구 요청), F2 (친구 수락), F3 (모임 초대), F4 (전원 투표 완료, idempotent — [D17](DECISIONS.md#d17--push-f4-idempotency-groupsf4_sent_at-column)), F5 (시간 확정)
- F6 (예약 완료), F7 (시간 임박)은 **Phase 3**
- 트리거 위치 결정 보류 ([Q-B3](OPEN_QUESTIONS.md#q-b3--푸시-알림-트리거-위치))
- 단일 dispatcher pattern 권고 ([Q-B5](OPEN_QUESTIONS.md#q-b5--edge-function-단일-dispatcher))

### 3.7. Gemini Vision (OCR — D2 keep)

- 학교 시간표 OCR
- Ground truth eval set ~20장
- OCR 일정 = `source = 'everytime'` enum 격리
- **외부 캘린더 push 안 함** (학기 시간표 캘린더 폭격 회피 — ENG_REVIEW §9.4)

---

## 4. Realtime 히트맵 (60fps critical) — [D11](DECISIONS.md#d11--realtime-히트맵--edge-function-합산-후-broadcast-옵션-b)

회사 운명이 이 부분 60fps에 걸려 있음 (ENG_REVIEW §1.4).

```
[클라이언트 A: 시간 투표]
    │
    ▼
INSERT INTO votes (group_id, user_id, slot_start, slot_end) ...
    │
    ▼
Supabase Postgres
    │
    ▼ (트리거)
Supabase Edge Function on_votes_change
    │
    ├── SELECT slot_minute, COUNT(*) FROM votes WHERE group_id = X GROUP BY slot_minute
    │   (group_id에 속한 모든 votes 합산 = heatmap aggregate)
    │
    └── supabase.channel('group:X').send({
        type: 'broadcast',
        event: 'heatmap_update',
        payload: { slots: [{ minute: 540, count: 3 }, ...] }
      })
    │
    ▼
[클라이언트 A, B, C, D, ...]
    │
    │   100ms debounce
    ▼
useSharedValue (Reanimated) 업데이트
    │
    ▼
셀 색 변화 (UI thread, 60fps 보장)
```

**60fps 구현 spec** ([D12](DECISIONS.md#d12--60fps-시간-그리드-구현-spec)):
1. Drag = `react-native-gesture-handler` + Reanimated **worklet** (UI thread, JS 영향 0)
2. 셀 상태 = `useSharedValue` (JS state X)
3. Vote commit = drag 종료 시 1회 + 100ms debounce
4. 가상화 = `FlashList` 또는 React.memo 셀
5. Heatmap receive도 별도 shared value

**측정 기준:** Hermes profile/Flipper frame drop 측정. 부하: 7명 모임 동시 투표. 저사양 baseline: iPhone SE 2, Galaxy A14.

---

## 5. 핵심 Funnel (Gate 측정 지점)

→ 게이트: [G1](DECISIONS.md#g1--gate-1-모임-확정--장소-확정-비율) · [G2](DECISIONS.md#g2--gate-2-장소-확정--예약하기-click-through--가장-critical)

```
[새 사용자]                            [기존 호스트]
    │                                        │
    ▼                                        ▼
카카오 OAuth (synthetic email + HMAC)         홈 화면
    │                                        │
약관 동의 모달                                 (+) FAB → 모임 만들기
    │                                        │
3 슬라이드 온보딩                             모임 이름·날짜·시간 그리드 입력
    │                                        │
홈 화면                                       친구 초대 + 카톡 공유 링크 생성
                                             │
                                             ▼
                                        시간 투표 영역 ────────────┐
                                        (Supabase Realtime 히트맵)  │ ※ 다른 멤버
                                             │                     │   동시 투표
                                             │ ◄───────────────────┘
                                             ▼
                                        ★ Gate #1 측정 ★
                                        모임 확정 (호스트가 시간 선택)
                                             │
                                             ▼
                                        F5 푸시 + Calendar push (멤버 N명)
                                             │
                                             ▼
                                        ★ Gate #2 측정 ★
                                        장소 정하기 섹션 노출
                                        ├── [장소만 정하기]
                                        │       └── 카톡 공유 → 종료
                                        └── [예약하기]  ← click-through 측정 지점
                                                │
                                                ▼
                                        지도 모드 → 제휴 마커 → 바텀시트
                                                │
                                                ▼
                                        "Phase 1+2: 준비 중" 안내 또는 silent
                                        (Phase 3 시 토스 결제 위젯)
```

---

## 6. 성능 Spec

### 6.1. 시간 그리드 60fps — 위 §4 참조

### 6.2. Cold start < 2초 ([D25](DECISIONS.md#d25--cold-start-target--2초--lazy-loading))

**Always load:** expo-router, react-native, supabase-js, zustand, expo-secure-store

**Lazy load (route 진입 시):**
- `@mj-studio/react-native-naver-map` — 지도 탭
- `expo-calendar` — 모임 확정 + Calendar push
- Branch SDK — 첫 진입 attribution check (단 SDK init은 startup)
- Gemini Vision — OCR 진입
- 토스 webview — Phase 3 (현재 미사용)

**측정:** EAS production binary cold start (iOS·Android × 저사양·중사양 4조합)

### 6.3. Kakao Local API quota

- Free tier: 30만 호출/일
- Client debounce 300-500ms + 5분 viewport 격자 캐싱
- Server proxy 미도입 (Phase 1+2)
- 베타 1000 DAU × 평균 10회 = 10000 호출/일 → 안전. Viral burst만 risk

### 6.4. Calendar push fan-out

- 호스트 1회 액션 → 외부 API 15개 호출 (10 Google + 5 Apple)
- Background queue (Supabase Function Hook + pg_cron)
- 호스트 액션은 즉시 응답 (비동기)
- Retry max 3
- Partial fail report

---

## 7. RLS & 보안

- **차단 일관성** ([D16](DECISIONS.md#d16--차단신고-일관성-helper-function--rls)): `is_blocked(viewer, target)` helper 함수 + RLS policy. 모든 SELECT 통과
  - 친구 검색, 추천, 모임 멤버, 초대 모두 일관 적용
  - 같은 모임 멤버 = 이미 참여 중이면 표시 유지 + 코멘트 hidden + 푸시 silent
- **synthetic email**은 일반 user처럼 동작하지만 외부 발송 불가 (보호)
- **HMAC secret**은 Edge Function 환경변수 (EAS secret + Supabase secret)
- **Branch.io key**는 클라 + 서버 양쪽
- **Kakao key / Naver key / Gemini key**는 모두 서버 (Edge Function) 통과

---

## 8. Implementation Notes (Code Quality)

### 8.1. 시간 슬롯 단위 fragmentation 방지 — [D14](DECISIONS.md#d14--시간-슬롯-단위-강제-15분--db-check-constraint)
- DB CHECK `start_minute % 15 = 0` AND `(end_minute - start_minute) % 15 = 0`
- Constant `SLOT_DURATION_MINUTES = 15` (server + client 공유)
- Prior MVP 30분 데이터 미이전 (fresh DB)

### 8.2. `schedules.source` enum semantic — [D15](DECISIONS.md#d15--schedulessource-enum--phase-12은-provider-구분-포기)
- `'manual' | 'google' | 'apple_ios' | 'everytime'`
- apple_ios = iOS 디바이스 통합 (iCloud + Google iOS + Outlook + 네이버 iOS)
- UX: "Apple Calendar (iOS 디바이스 모든 일정 통합)"으로 표시
- Provider 구분은 차기 ([Q-C5](OPEN_QUESTIONS.md#q-c5--외부-캘린더-양방향-동기화) 영역)

### 8.3. KST timezone 강제 — [D13](DECISIONS.md#d13--kst-강제-db는-timestamptz-utc)
- DB = TIMESTAMPTZ (UTC 정규화)
- Client = `luxon` or `date-fns-tz` + `Asia/Seoul` 강제
- 시간 그리드 09:00~24:00 = 항상 KST
- 해외 사용자: "KST 기준으로 표시 중" 작은 라벨
- `new Date()` 직접 사용 금지 (rules/ko-kr.md + design-guard hook)

### 8.4. 차단 RLS helper — [D16](DECISIONS.md#d16--차단신고-일관성-helper-function--rls)
- `is_blocked(viewer_id UUID, target_id UUID) RETURNS BOOLEAN`
- 모든 SELECT가 통과
- 차단한 사람이 새 모임 만들고 초대 = 초대 hidden 또는 "차단된 사용자로부터" 라벨

### 8.5. F4 idempotency — [D17](DECISIONS.md#d17--push-f4-idempotency-groupsf4_sent_at-column)
- `groups.f4_sent_at` (timestamp nullable) column
- Edge Function: UPDATE WHERE `f4_sent_at IS NULL AND all_member_voted` 트랜잭션 내

### 8.6. Comments 인디케이터 (deferred) — [Q-B19](OPEN_QUESTIONS.md#q-b19--comments-인디케이터-last_seen_comment_id)
- 정책: 코멘트 푸시 알림 발송 안 함 (의도적)
- 모임 카드 "새 코멘트 N" 배지 (앱 내 only). `group_member_states.last_seen_comment_id` 추적 — Q-B19 closure 시 구현

---

## 9. Phase 1+2 → Phase 3 Migration Path

```
Phase 1+2 (출시)              Phase 3 (Gate 통과 후)
─────────────────────         ─────────────────────
users                          users (변경 없음)
friendships                    friendships (변경 없음)
friend_requests                friend_requests (변경 없음)
groups                         groups + reservation_id (FK 추가)
  - confirmed_at                  - confirmed_at
  - confirmed_place_id            - confirmed_place_id
  - f4_sent_at                    - f4_sent_at
                                  - reservation_id (NEW, nullable)
group_members                  group_members (변경 없음)
group_guests                   group_guests (변경 없음)
group_invitations              group_invitations (변경 없음)
votes                          votes (변경 없음)
places                         places (변경 없음)
  - partnership_id (FK,            - partnership_id (변경 없음)
    nullable)
schedules                      schedules (변경 없음)
comments                       comments (변경 없음)
partnerships                   partnerships (변경 없음)
push_tokens                    push_tokens (변경 없음)
notification_settings          notification_settings (변경 없음)
reports                        reports (변경 없음)
blocks                         blocks (변경 없음)
branch_attributions            branch_attributions (변경 없음)
                               ┌─ reservations (NEW)
                               ├─ payments (NEW)
                               └─ payouts (NEW)

Migration cost: 3 tables ADD + groups에 1 column ADD = 작음
```

→ Phase 3 진입 시 schema 설계: [Q-C2](OPEN_QUESTIONS.md#q-c2--phase-3-도메인-schema-설계)

---

## 10. Failure Modes (Critical Gaps)

ENG_REVIEW §8 (12개 분석, 4개 critical):

| # | Failure mode | Mitigation |
|---|---|---|
| 1 | Kakao synthetic email OAuth 정책 변경 | **CRITICAL** — D1 verify-track + S16 Apple ID fallback |
| 2 | Kakao Local API 약관 위반 takedown | **CRITICAL** — D1 + S16 Naver Search fallback |
| 3 | Supabase Realtime disconnect during vote | HIGH — info-bg 칩 "실시간 갱신 일시 중단" (DESIGN §11.4, [Q-B6](OPEN_QUESTIONS.md#q-b6--realtime-disconnect-ui)) |
| 4 | Branch.io attribution miss (한국 NAT) | **CRITICAL** — W1 PoC ([Q-A6](OPEN_QUESTIONS.md#q-a6--branchio-한국-nat-attribution-정확도-poc)) + 수동 fallback ("초대받은 모임 코드") |
| 5 | 호스트 "확정" 더블 탭 race | HIGH — Idempotency ([D17](DECISIONS.md#d17--push-f4-idempotency-groupsf4_sent_at-column) + S04 lock) |
| 6 | Calendar push partial fail (silent) | HIGH — 호스트 알림 ([D19](DECISIONS.md#d19--calendar-sync-단방향-부분-실패-명시)) |
| 7 | Kakao Local API rate limit hit | HIGH — fallback "잠시 후 다시" + 캐시 우선 ([D26](DECISIONS.md#d26--kakao-local-api-quota-client-debounce--viewport-cache)) |
| 8 | OCR 오인식 → 잘못된 학기 반복 일정 | (D2 keep) Confirm step + ground truth eval (S03) |
| 9 | 게스트 토큰 충돌 (다른 모임) | MEDIUM — 모임별 별도 토큰 ([Q-B7](OPEN_QUESTIONS.md#q-b7--게스트-토큰-충돌-같은-브라우저-다른-모임)) |
| 10 | iOS Calendar 권한 회수 후 모임 확정 | MEDIUM — 미리 모달 안내 (D19) |
| 11 | Push F4 race | MEDIUM — D17 트랜잭션 |
| 12 | 사용자 시간대 (해외) | MEDIUM — D13 KST 강제 |

---

## 11. ASCII Diagrams Index

본 문서에 포함된 5개 다이어그램:

1. **§3.1** Kakao OAuth synthetic email + HMAC flow
2. **§3.5** Branch.io 게스트→회원 attribution timeline
3. **§4** Realtime 히트맵 propagation (Edge Function aggregation)
4. **§5** Phase 1+2 핵심 funnel (Gate 측정 지점)
5. **§9** Phase 1+2 → Phase 3 schema migration

---

**관련 문서:**
- [PRD.md](PRD.md) — 제품 기획 본체
- [DESIGN.md](DESIGN.md) — 시각 시스템
- [DECISIONS.md](DECISIONS.md) — 모든 결정의 단일 진실
- [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) — 미해결 질문
- [TASK_BACKLOG.md](TASK_BACKLOG.md) — 빌드 태스크 (17 steps, 4 lanes)
- [TEST_PLAN.md](TEST_PLAN.md) — 테스트 plan
