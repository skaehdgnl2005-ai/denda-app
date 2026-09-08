# Architecture — 된다 (DenDa) Phase 1+2

> 시스템 다이어그램·데이터 모델·외부 통합·성능 spec. 결정 본문은 [DECISIONS.md](DECISIONS.md). 본 문서는 구현 진입 시 참조.

---

## 1. 시스템 전체 구성

```
[모바일 앱 (RN + Expo)]
     │
     │  HTTPS + JWT
     ▼
[Supabase Edge Functions]    ← Gemini Vision (OCR) · F1-F5 push · votes_aggregate · group_confirm · click_log · attribution_match · calendar_push
     │
     ├── [Postgres + RLS + Realtime broadcast]    ← 18 tables (D3 partnerships only)
     ├── [Auth (Kakao OIDC + signInWithIdToken)]  ← D29
     └── [Storage]                                ← 프로필 이미지 (Phase 3)
     │
     └── 외부 API:
         ├── Kakao Local API (D1 + Q-A2 — 지도용)
         ├── Kakao OIDC (D29 — Supabase Auth via signInWithIdToken)
         ├── Naver Map SDK
         ├── Google Calendar API
         ├── Gemini Vision (OCR — D2 keep)
         └── (Phase 3) 토스 결제

[Web Guest (Next.js + Vercel)]    ← S14 — 별도 codebase, D23
     │
     │  공통: Supabase (anon key)
     ▼
[Supabase Edge Functions]
```

## 2. 데이터 모델 (Phase 1+2 schema)

→ 결정: [D3](DECISIONS.md#d3--phase-3-schema-설계-시점-옵션-b--partnerships-only) — `reservations`/`payments`/`payouts`는 Phase 3 진입 시 설계.
→ 기능 관점 해설 (비전공자용): [DATA_MODEL_GUIDE.md](DATA_MODEL_GUIDE.md)

| 테이블 | 핵심 컬럼 | 비고 |
|---|---|---|
| `users` | id, kakao_id, email (nullable), nickname, phone, created_at | [D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede) OIDC. email은 Phase 3 비즈앱 등록 + `account_email` scope 후 채움 |
| `friendships` | user_id, friend_id, created_at | |
| `friend_requests` | from_user_id, to_user_id, status, created_at | |
| `groups` | id, host_id, name, dates, **confirmed_at**, **confirmed_place_id (FK places)**, **f4_sent_at (timestamp nullable — D17)**, **invite_code (CHAR(4))**, f5_sent_at, **calendar_pushed_at**, calendar_retry_count, partial_fail_list | f4_sent_at = push F4 idempotency. invite_code = 자체 attribution fallback ([D28](DECISIONS.md#d28--자체-deferred-deep-link-구축-attribution-saas-회피-도메인-구매-회피)). calendar_* = D20 background queue ([0009](../supabase/migrations/0009_calendar_push_queue.sql)) |
| `group_members` | group_id, user_id, joined_at | |
| `group_guests` | guest_token, group_id, nickname, **converted_user_id (FK users nullable)**, voted_at | Web 게스트 |
| `group_invitations` | group_id, inviter_id, invitee_id, status | |
| `votes` | id, group_id, user_id, **start_minute**, end_minute, day, created_at. CHECK `start_minute % 15 = 0` ([D14](DECISIONS.md#d14--시간-슬롯-단위-강제-15분--db-check-constraint)) | 15분 단위 슬롯 |
| `time_slots` | (논리적, votes에서 집계) | 슬롯 자체 저장 X — votes만 |
| `places` | id, kakao_place_id, name, lat, lng (WGS84 — [D18](DECISIONS.md#d18--좌표계-정규화-layer)), category, **partnership_id (FK nullable)**, **source ('kakao'\|'naver')**, provider_place_id | source·provider_place_id는 [0021](../supabase/migrations/0021_places_provider.sql) |
| `partnerships` | id, signed_at, status, contact_kakao_id, communication_log | Phase 1+2 read-only. FK 방향은 `places.partnership_id` (partnerships에 place_id 없음) |
| `group_origins` | group_id, user_id (PK 복합), label, lat, lng | 중간지점용 멤버 출발지. 1인 1출발지, 탈퇴 시 트리거로 소거 ([0023](../supabase/migrations/0023_group_origins.sql), D41) |
| `schedules` | id, user_id, **source** ('manual'\|'google'\|'apple_ios'\|'everytime' — [D15](DECISIONS.md#d15--schedulessource-enum--phase-12은-provider-구분-포기)), title, start_at (TIMESTAMPTZ — [D13](DECISIONS.md#d13--kst-강제-db는-timestamptz-utc)), end_at, recurrence_rule | apple_ios = multi-source bucket |
| `comments` | id, group_id, user_id, content, created_at | 푸시 알림 발송 안 함 (의도적) |
| `push_tokens` | user_id, token, platform, updated_at | |
| `notification_settings` | user_id, f1_enabled, ..., f5_enabled | F6·F7는 Phase 3 |
| `reports` | reporter_id, target_id, reason, created_at | 운영팀 카톡 manual |
| `blocks` | blocker_id, blocked_id, created_at | [D16](DECISIONS.md#d16--차단신고-일관성-helper-function--rls) helper |
| `branch_attributions` | branch_link_id (= short URL token), group_id, guest_token, **converted_user_id**, **converted_at**, **ip_hash**, **ua_hash**, **clicked_at** | 자체 deferred deep link ([D28](DECISIONS.md#d28--자체-deferred-deep-link-구축-attribution-saas-회피-도메인-구매-회피)). table 이름 prefix `branch_`는 cost 회피 위해 유지 (의미적으로 generic). ip_hash·ua_hash·clicked_at는 fingerprint 매칭용 추가 |
| `click_events` | **event_id (클라 발급 UUID PK — idempotency)**, user_id, group_id, place_id, partnership_id (snapshot), segment_label ('P1'\|'P2' nullable), clicked_at | **Gate #2 single source of truth**. 더블 탭 → ON CONFLICT DO NOTHING ([0017](../supabase/migrations/0017_click_events.sql)) |
| `user_oauth_tokens` | id, user_id, provider ('google_calendar'), access_token, refresh_token, expires_at, scope. UNIQUE (user_id, provider) | Google Calendar 서버 측 push용. INSERT는 `upsert_user_oauth_tokens` RPC only ([D35](DECISIONS.md#d35--google-calendar-oauth-token-서버-측-저장--user_oauth_tokens-table), [0012](../supabase/migrations/0012_user_oauth_tokens.sql)) |
| `calendar_push_apple_pending` | id, group_id, user_id, payload (JSONB), **completed_at (NULL = pending)**. UNIQUE (group_id, user_id) | Apple은 서버 push 불가 → 클라 foreground polling ([D34](DECISIONS.md#d34--apple-calendar-sync--클라-polling-패턴-q-b22-close), [0013](../supabase/migrations/0013_calendar_push_apple_pending.sql)). pending ≠ failure |
| `users` (추가 컬럼) | **calendar_preference** ('google'\|'apple_ios'\|'both'\|'none'\|NULL) | 캘린더 연동 선택. worker가 'google'\|'both'만 SELECT ([0011](../supabase/migrations/0011_users_calendar_preference.sql)) |

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

### 3.1. Kakao OIDC OAuth — [D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede)

→ D21 (synthetic email + HMAC) supersede. Q-A1 closed by D29.

```
[클라이언트 카카오 로그인]
    │
    ▼
Kakao SDK login(scope=['openid','profile_nickname']) + nonce
    │
    │   ※ scope=openid 으로 id_token 발급 받음
    │   ※ account_email은 비즈앱 한정 → Phase 3로 이연
    ▼
KakaoLoginResponse { idToken, accessToken (사용 안 함), ... }
    │
    ▼
supabase.auth.signInWithIdToken({
    provider: 'kakao',
    token: idToken,
    nonce: <원본 nonce>     // replay 방지
})
    │
    ▼
Supabase Auth (서버 측 검증)
    │
    ├── issuer = 'https://kauth.kakao.com'
    ├── audience = Kakao REST API key
    ├── signature (Kakao JWKS)
    ├── nonce 매칭
    ├── exp 미만료
    │
    ├── auth.users 행 자동 생성/매칭
    │   - id = uuid (Supabase 생성)
    │   - email = null (베타, account_email scope 없음)
    │   - raw_user_meta_data 에 id_token claims 저장
    │     (sub = 카카오 user_id, nickname, picture)
    │
    └── on_auth_user_created trigger (handle_new_auth_user 함수)
        → public.users INSERT
           - kakao_id = raw_user_meta_data->>'sub'
           - nickname = raw_user_meta_data->>'nickname' (fallback 'name','익명')
           - email = NEW.email (null in 베타)
    │
    ▼
session JWT 발급 + 클라이언트 SecureStore 저장
    │
    ▼
앱 사용
```

**삭제된 항목** (D21 잔재):
- `supabase/functions/kakao_login/` Edge Function 전체 — Supabase Auth가 검증·user 생성 모두 담당
- `users.synthetic_email` 컬럼 — migration 0003에서 DROP
- HMAC secret의 D21 용도 — D28 fingerprint salt로 용도 변경 (secret 자체는 유지)
- `_lib/hmac.ts::syntheticEmail()` 함수만 삭제 (`hmacSha256()` 등 utility는 D28 재사용)

**Phase 3 전환 (Gate #2 ≥ 25%)**:
1. 카카오 디벨로퍼스 비즈앱 신청 (사업자등록증 제출, 1-2주)
2. 승인 후 카카오 portal에서 `account_email` consent 활성화
3. 앱 코드: `KakaoOIDCProvider`의 scope에 `account_email` 추가
4. 기존 user 재로그인 시 신규 scope 동의 → 새 id_token으로 `auth.users.email` 자동 채워짐
5. Schema 변경 불필요 (`email` 이미 nullable)

**Fallback (Apple 심사 — Phase 3)**: `AppleAuthProvider` 추가 (App Store guideline 4.8). `AuthProvider` interface 추상화는 S01에서 미리 구현 (S16 lazy 대비).

### 3.2. Kakao Local API (장소 검색)

→ [Q-A2](OPEN_QUESTIONS.md#q-a2--kakao-local-api-약관-외부-지도-sdk-위-표시) ✅ 허용 (Closed by [D37](DECISIONS.md#d37--q-a2-카카오-local-api-약관-허용-답변-수신--kakaolocalprovider-평가-트랙), 2026-06-01) — 현 primary는 D36 NaverSearchProvider, KakaoLocalProvider 평가 트랙
> ⚠️ proxy 충돌 정리됨([Q-B8](OPEN_QUESTIONS.md#q-b8--카카오-local-api-server-proxy-도입-여부) 참조): **key-secrecy proxy는 rule 7로 강제**(Kakao Local REST key = Edge only) → Kakao Local은 `kakao_local_search` Edge proxy 경유 필수(Naver `naver_local_search`와 동형). 아래 D26 "client debounce"·Q-B8 "cost-proxy 미도입"은 throttling/비용 proxy 얘기로 key 경로와 별개. D37 결과영향 #2 참조.

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

### 3.5. 자체 deferred deep link (게스트→회원 attribution) — [D28](DECISIONS.md#d28--자체-deferred-deep-link-구축-attribution-saas-회피-도메인-구매-회피)

→ 정확도 PoC: [Q-A6](OPEN_QUESTIONS.md#q-a6) (W1 병렬)

**아키텍처 결정**:
- 단축 URL host = **Vercel default subdomain** `denda.vercel.app/g/<short_token>` (별도 도메인 구매 회피)
- web-guest (S14, Next.js)가 `/g/<token>` route 처리
- AASA + assetlinks.json은 Vercel public hosting (`/.well-known/apple-app-site-association` 등)
- iOS Universal Links + Android App Links 모두 `denda.vercel.app` 도메인으로 verification

```
W0 - 호스트가 모임 생성 → 단축 토큰 발급 (8자 random)
    │
    │   group_token = uuid_short(8)
    │   group invite_code = 4자리 numeric (fallback용 — 모든 게스트에게 노출)
    │
    ▼
W0 - 카톡 모임 초대 링크 공유
    │
    │   URL: https://denda.vercel.app/g/<short_token>
    │   카톡 메시지에 invite_code도 함께 표시 (예: "초대 코드: 4829")
    │
    ▼
사용자 브라우저 클릭 → web-guest (Vercel) `/g/<token>` route
    │
    ├── localStorage: guest_token = UUID
    ├── DB INSERT: group_guests (guest_token, group_id, nickname)
    ├── DB INSERT: branch_attributions (
    │     branch_link_id = short_token,
    │     group_id, guest_token,
    │     ip_hash = sha256(req.ip + salt),
    │     ua_hash = sha256(req.user_agent + salt),
    │     clicked_at = NOW()
    │   )
    └── 투표 그리드 표시 → 게스트 투표 완료
    │
    ▼
"결과 알림 받으려면 → 앱 받기" CTA
    │
    │   Universal Link: https://denda.vercel.app/g/<short_token>
    │   (앱 설치 시 자동 open, 미설치 시 App Store/Play Store)
    │
    ▼
W0+δ - 앱 첫 실행
    │
    │   1) Universal Link 매칭 (best case 정확도 ≈ 80%)
    │   2) Fingerprint 매칭 (Universal Link miss 시)
    │      - IP hash + UA hash + install 시점이 최근 클릭과 일치
    │      - Supabase Edge Function: GET /api/attribution/match
    │      - 매칭 성공률 한국 NAT 환경에서 50% 이하 (예상)
    │   3) 명시적 fallback (앞 둘 모두 miss 시)
    │      - 앱 첫 화면에서 "초대받은 모임 코드 입력" 모달 강제 노출
    │      - 4자리 invite_code 입력 → 그룹 매칭
    │
    ▼
카카오 OAuth → user_id 확보
    │
    ▼
DB UPDATE: branch_attributions
SET converted_user_id = X, converted_at = NOW()
WHERE branch_link_id = ... (또는 invite_code 매칭)
    │
    └── group_guests → group_members 마이그레이션
        (또는 둘 다 유지하고 group_guests.converted_user_id 설정)
    │
    ▼
모임 자동 합류 + 모임 list에 표시
```

**iOS Universal Links 셋업**:
- `app.json` ios.associatedDomains: `["applinks:denda.vercel.app"]`
- AASA 파일을 Vercel에 호스팅 (Next.js의 `public/.well-known/apple-app-site-association`)
- AASA에 `paths: ["/g/*"]` 명시
- Apple 캐시 24-48시간 — TestFlight build로 실제 device 검증 의무

**Android App Links 셋업**:
- `app.json` android.intentFilters: scheme `https`, host `denda.vercel.app`, pathPattern `/g/.*`
- `public/.well-known/assetlinks.json` Vercel hosting
- `package_name` + sha256 cert fingerprint 명시
- `adb shell pm verify-app-links` 검증

**Fingerprint 매칭 알고리즘**:
- ip_hash: sha256(IP + HMAC_SECRET)
- ua_hash: sha256(User-Agent + HMAC_SECRET)
- Install 시점 (`clicked_at` 이후 24시간 이내) + IP/UA 매칭
- 한국 NAT 환경에서 같은 IP 수천 명 → IP만으로는 정확도 낮음 → UA 추가 매칭
- ATT 동의 거부 시 IDFA 없음 → IP+UA만 → 정확도 ↓

**ATT / PIPA 대응**:
- iOS 14+ App Tracking Transparency 모달: 앱 첫 실행 시 표시 (선택 가능)
- 한국 PIPA: 개인정보처리방침에 "IP 해시 + User-Agent 해시 수집 (모임 자동 합류 목적)" 명시
- 동의 없을 시 fingerprint 매칭 skip → 명시적 코드 입력 fallback만

**Risk acknowledgement** ([D28](DECISIONS.md#d28--자체-deferred-deep-link-구축-attribution-saas-회피-도메인-구매-회피) 명시):
- G2 게이트 측정 노이즈 (정확도 50% 이하)
- viral funnel UX 마찰 (코드 입력 강제)
- 1-2주 추가 개발 시간
- Phase 3 광고 launch 시 SaaS 추가 도입 필요

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
카카오 OIDC (signInWithIdToken)               홈 화면
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
- Gemini Vision — OCR 진입
- 토스 webview — Phase 3 (현재 미사용)

**측정:** EAS production binary cold start (iOS·Android × 저사양·중사양 4조합)

### 6.3. Kakao Local API quota

- Free tier: 30만 호출/일
- Client debounce 300-500ms + 5분 viewport 격자 캐싱
- Server proxy 미도입 (Phase 1+2)
- 베타 1000 DAU × 평균 10회 = 10000 호출/일 → 안전. Viral burst만 risk
