# Progress — Phase 1+2

> Phase 1+2 빌드·출시 burn-down + Gate 측정 추적.
> `/ship-task` 시 카운트 자동 +1. Gate 측정 시작 후 weekly update.

---

## 📊 Build Burn-down

**Phase 1+2 timeline**: 3.5주 (2026-05-22 기준, Sprint 0 진행 중)

| Sprint | 기간 | 계획 deliverable | 실제 진행 | 상태 |
|---|---|---|---|---|
| **Sprint 0** | W-1 (2026-05-22 ~ 2026-05-28) | 12 인프라 항목 + 디자인 자산 | Expo init + Supabase + EAS Build + 카카오 portal + Supabase Auth Kakao + 키해시 등록 완료 | ON_TRACK |
| **Sprint 1** | W0 | S00, S11, S13 skeleton | S00 ✅, **S11 ✅ (백필 2026-05-26, 다크 검증 deferred)**, **S13 skeleton ✅ 강화 2026-05-27** (eas.json env/resourceClass + cold-start 계측 D25 + secret manifest + runbook. 인증서·실기기 측정은 운영 트랙) | DONE (S00·S11), S13 PARTIAL |
| **Sprint 2** | W1 | S01 + S10 + S14 병행 (★ Kakao 답변 review) | **S01 ✅** (D29), **S14 ✅ DONE 2026-05-26** (skeleton + utils + test-augment + violations-fix + e2e-setup + e2e-full-fix + e2e-residual + cross-day-sweep — Jest 84 + Playwright 18, 일체 0 skip), **S10 데이터·로직 레이어 ✅ 2026-05-28** (coords/normalize D18 + viewportCache D26 + filter + clustering + useMapSearch + map.tsx scaffold — native Naver Maps SDK 렌더는 EAS 운영 트랙), **UI-§17 ✅ 2026-05-26** | IN_PROGRESS (S10 native 트랙) |
| **Sprint 3** | W2 | S05 + S07 + S03 + S08 (baseline 시작) | **S05-UI ✅ + S05a ✅ + S05b ✅ (PR #3 78c8fe9) + S05c ✅ + S05d ✅ + S05 worklet drag ✅ + S05-screen-confirm ✅ 2026-05-26** = S05 acceptance 7/7 (S05e 60fps 실기기만 잔여) / **S07 ✅ DONE 2026-05-26** / **S03 ✅ DONE 2026-05-26 (a+b)** / **S08 ✅ DONE 2026-05-27** (backend + UI 전부 — 마커 trigger는 S10 unblock 후 wire-up only) | IN_PROGRESS |
| **Sprint 4** | W3 | S04 + S06 + S12 + S15 (TestFlight) | **S04 ✅ DONE** + **S06 ✅ DONE 2026-05-26** + **S12 ✅ DONE 2026-05-26** + **S15-deeplink ✅ DONE 2026-05-27** (6/6 sub-task: schema 0016 + Deno fingerprint/attribution helpers + 2 Edge Functions + web click_log + InviteCodeModal + AttributionRoot + app.config.ts associatedDomains/intentFilters + AASA + assetlinks.json. EAS Build prereq 별도 트랙) | IN_PROGRESS (S15-mapmode + S13 잔여) |
| **W3.5** | W3.5 | S17 QA 종합 + 안암 invite-only launch | 미시작 | — |

---

## 📈 Task 진척

**총 17 태스크 (S00 ~ S16) + S17 QA**

```
DONE 정식:  ████████████▒▒▒▒▒▒▒▒  12 / 17 (70.6%) — S00, S01, S03, S04, S06, S07, S08, S11, S12, S14, S15-deeplink (S05도 사실상 7/7)
Active:    █████████████▒▒▒▒▒▒▒  13 / 17 (76.5%) — + S05 acceptance 7/7 (S05e 운영), S13 partial
```

| Lane | TODO | IN_PROGRESS (partial) | DONE | BLOCKED |
|---|---|---|---|---|
| **A (Foundation·Auth·Time grid·OCR)** | 0 | 1 (S05 acceptance 7/7 — S05e 60fps 실기기 잔여) | 5 (S00, S01, S03, S04, S07) | 0 |
| **B (Map·Click-through·지도-일정)** | 1 (S15-mapmode) | 1 (S10 — 정책 블록 해소, native/EAS gating) | 1 (S08) | 0 |
| **C (Web guest)** | 0 | 0 | 2 (S14, S15-deeplink) | 0 |
| **D (Cross-cutting)** | 1 (S17) | 2 (S13 skeleton — 인증서·실기기 운영 트랙, S16 map-provider partial) | 3 (S06, S11, S12) | 0 |

세부: [TASK_BACKLOG.md](TASK_BACKLOG.md)

---

## 🎯 Active Gates

### D1 — Kakao Local API 정책 답변 (W1 deadline, auth 부분은 D29로 해소)
- **마감**: 2026-05-28
- **상태**: **No-answer 액션 발동 (2026-05-27, [D36](DECISIONS.md#d36--s16-장소-검색-fallback--naversearchprovider-eager-q-a2-no-answer--edge-proxy))** — Q-A2 답변 미수신 → NaverSearchProvider eager fallback 구축 완료(provider 레이어). Auth 부분(Q-A1)은 D29로 closed (2026-05-22)
- **블록 대상**: S10(지도 화면)은 정책 블록 해소 → native/EAS gating만. S16 map-provider IN_PROGRESS. S01은 D29로 해소
- **답변 추후 수신 시**: "허용"이면 KakaoLocalProvider를 같은 PlaceSearchProvider 인터페이스로 추가 평가(데이터 quality 우위 시 primary 교체). 인터페이스·Edge proxy·좌표 정규화는 재사용

→ [DECISIONS.md#d1](DECISIONS.md#d1--kakao-oauth--local-api-정책-verify-track--lazy-backup) | [OPEN_QUESTIONS.md#q-a2](OPEN_QUESTIONS.md#q-a2--kakao-local-api-약관-외부-지도-sdk-위-표시) | [DECISIONS.md#d29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede)

---

## 📏 KPI 측정 (Launch 후)

### Gate #1 — 모임 확정 → 장소 확정 비율 ([G1](DECISIONS.md#g1--gate-1-모임-확정--장소-확정-비율))

**측정 기간**: W2-W8 (W0-W2 baseline 후)

| 측정 시점 | 모임 확정 N | 장소 확정 N | 비율 | 임계 판정 |
|---|---|---|---|---|
| W2 | — | — | — | baseline |
| W3 | — | — | — | — |
| W4 | — | — | — | — |
| W5 | — | — | — | — |
| W6 | — | — | — | — |
| W7 | — | — | — | — |
| W8 | — | — | — | final |

**판정**:
- ≥40% 강한 신호 → Phase 3 시그널
- 20-39% 보류 (UX 개선 + 2주 추가)
- <20% 장소 기능 가설 무너짐

---

### Gate #2 — 장소 확정 → "예약하기" click-through ([G2](DECISIONS.md#g2--gate-2-장소-확정--예약하기-click-through--가장-critical))

**★ Phase 3 commit 단일 게이트**

**측정 기간**: W2-W8

| 측정 시점 | 장소 확정 N | "예약하기" click N | 비율 | Segment (P1/P2) | 임계 판정 |
|---|---|---|---|---|---|
| W2 | — | — | — | — | baseline |
| W3 | — | — | — | — | — |
| W4 | — | — | — | — | — |
| W5 | — | — | — | — | — |
| W6 | — | — | — | — | — |
| W7 | — | — | — | — | — |
| W8 | — | — | — | — | final |

**판정**:
- ≥25% 강한 신호 → **Phase 3 full commit**
- 10-24% 보류 (segment 분리 측정)
- **<10% 즉시 3-path 결정**: (a) coordination-only reframe (b) 식당 timeline 재조정 (c) P2 별도 acquisition

---

## 📊 Sub-KPI (참고)

| 지표 | 목표 | 현재 | 측정 시작 |
|---|---|---|---|
| 사용자 200명+ 외부 acquisition | W8 | — | W0 |
| 활성 모임 100개+ | W8 | — | W0 |
| 식당 20곳 retention (≥80%, 16곳+) | 월간 | 20/20 (사인 완료) | (Phase 1+2 진행 중) |
| Realtime 히트맵 60fps 유지 | 모든 모임 | — | S05 완료 후 |
| Cold start < 2초 | iOS+Android × 저사양·중사양 | **JS-TTI 237ms** (Galaxy A10, preview release APK, 2026-05-28) ✅ <2000ms. 단 측정범위=JS 번들 eval→interactive(네이티브 prefix 미포함). 전체 권위 숫자(adb am start -W)는 deferred | S13 ✅ Android 측정 (iOS·full number 잔여) |
| Kakao Local API quota 안 < 30만/일 | 일간 | — | S10 launch 후 |
| Branch.io attribution 정확도 ≥70% | W1 PoC | — | Q-A6 PoC 결과 |

---

## ✅ Sprint 0 — Pre-build 인프라 체크리스트

[TASK_BACKLOG.md#sprint-0](TASK_BACKLOG.md#sprint-0--pre-build-인프라-체크리스트-eng_review-10) 참조. 진행 현황은 거기서 직접 update.

---

## 🔄 주차별 Velocity

(태스크 완료 시작 후 누적)

| 주차 | 완료 태스크 | 누적 | 비고 |
|---|---|---|---|
| W-1 (Sprint 0) | S00 | 1 | 인프라 셋업 + Backend foundation |
| W0 (Sprint 1) | S11 (백필 partial) | 2 | design system + Pretendard |
| W1 (Sprint 2) | S01, S14-skel, S05-UI, S07-UI (백필), UI-§17, S05a + S07-backend (PR 대기), **S14-utils ✅ + S14-test-augment ✅ + S14-violations-fix ✅ + S14-e2e-setup ✅ 2026-05-26** | ~12 (정식 DONE 1: S01) | ★ D29 OIDC 채택 + §17 신설 + worktree backend 2건 + S14 TDD 사이클 4단 완성 (lib RN spec mirror + 안전망 + violations fix + Playwright base) |
| W2 (Sprint 3) | S03a+S03b → S03 ✅, S07-d16-audit + S07-report + S07-block-supabase → S07 ✅, D31 + D32, S05b ✅ (PR #3 merged 78c8fe9) + S05c + S05d + S05-cleanup + **S05a + Q-B21 close** + **S05 worklet drag ✅** + **S05-screen-confirm ✅ 2026-05-26** | 4 (S03·S07 DONE 정식) | OCR 끝. S07 완성. S05 acceptance 7/7 완료 — S05e 60fps 부하만 잔여(실기기 필요). worklet drag = reanimated 4 + gesture-handler 2 + worklets 0.8 lazy install + D12 의무 패턴 통합. S05-screen-confirm으로 화면 + 호스트 확정 surface 완성 |
| W3 (Sprint 4) | **S04 ✅ DONE** + **S06 ✅ DONE 2026-05-26** + **S15-deeplink-schema 2026-05-26** + **S12 ✅ DONE 정식 2026-05-26** (4 sub-task 누적: backend-f1-f4 + publishers-f4 + client + mount, `_layout.tsx` PushRegistrationConnected wire-up까지 완성). D34(Q-B22 close)·D35 신규 | 6 | Sprint 4 early start. S06·S12 정식 DONE. S15-deeplink schema 진입. S12 잔여 prereq: EAS Build projectId·APNs/FCM + 마이크로카피 founder review + S07 후속 F1/F2/F3 실 publisher (friends/invitations API supabase 전환 시) |
| W3.5 | — | — | Launch |

추가 (post-MVP, Lane E 여정 척추): **S18 모임 생성 flow ✅ 2026-05-28** (create_group RPC 0018 + createGroup/dateOptions lib + app/group/new.tsx + 홈/친구탭 진입 wire-up. Jest +16. 임계경로 척추 1번째 — 모임 생성 진입로 확보)

추가 (Sprint 3 중): **S10 데이터·로직 레이어 ✅ 2026-05-28** (coords/normalize D18 + coords/distance + viewportCache D26 + placeFilter + clustering + useMapSearch hook + map.tsx scaffold. Jest +69. native Naver Maps SDK 렌더는 S13 EAS 운영 트랙)

---

## 📅 마지막 업데이트

- **날짜**: 2026-05-28
- **업데이트한 사람**: **S18 모임 생성 flow ship (DONE)** — 사용자 "start task S18". Lane E(여정 척추) 임계경로 1번째 — 앱 안에서 모임을 만드는 진입로 확보(이전엔 `/group/[id]` 그리드에 도달 불가). [plan](TASK_BACKLOG.md) T1~T4 TDD-first: `dateOptions.ts`(KST 후보 날짜 순수 함수 buildDateOptions/formatDateChip/todayKstIso — luxon Asia/Seoul, Jest 6) + `0018_create_group_rpc.sql`(create_group RPC — SECURITY INVOKER, groups + 호스트 group_members 원자적 INSERT, host_id=auth.uid() 위변조 방지, invite_code는 0016 트리거 자동) + `create.ts`(createGroup wrapper + 한국어 에러, Jest 7) + `app/group/new.tsx`(모임 이름 + 후보 날짜 다중선택 최대 7일 + brand-500 fill CTA 1개 §17 + chip hitSlop, Jest 3) + 홈 CTA·친구탭 handleMakeGroup → `router.push('/group/new')` 실연결(친구탭 테스트 Alert→navigation 갱신). typedRoutes(SDK56) 아티팩트 `expo start`로 regen(`/group/new` 반영, gitignored). Jest 670 + 1 skip(654→+16), typecheck 0, lint 0 errors(11 pre-existing warnings), @reviewer Critical 4 CLEARED. S19(fetchMyGroups + 홈 '다가오는 모임' 실데이터)는 같은 plan T5·T6, Depends 충족 → unblocked. **이전**: **S10 지도 + 장소 검색 데이터·로직 레이어 ship (PARTIAL)** — 사용자 "start task S10". native Naver Maps SDK 렌더링이 EAS Build 의존(S13)이라 S08-ui/S16 패턴(테스트 가능한 데이터·로직 레이어 먼저, native/EAS는 운영 트랙) 사용자 승인 후 적용. TDD-first 7 모듈: `coords/normalize.ts`(D18 WGS84 단일 진입점 + toKakaoXY x=lng/y=lat swap 방지) + `coords/distance.ts`(haversine) + `places/viewportCache.ts`(D26 5분 격자 캐시 + LRU eviction) + `placeFilter.ts`(카테고리 substring + 반경 haversine) + `clustering.ts`(격자 Layer 1 fallback) + `useMapSearch.ts`(debounce 400ms + 캐시 hit skip + 에러 시 이전 결과 유지 + reqId out-of-order 방어) + `app/(tabs)/map.tsx`(검색 wire + "지도 준비 중" info chip + 5-state). Jest 654 + 1 skip (585→+69), typecheck 0, eslint 0 errors(9 pre-existing warnings), @reviewer CLEARED(Critical 4 통과). S10 IN_PROGRESS 유지 — native 트랙(@mj-studio/react-native-naver-map 렌더 + 제휴 마커 PNG + isNightModeEnabled + 마커 onPress→S08 place route)은 EAS Build 운영 트랙. **이전**: **S13 build bring-up — preview APK 실기기 빌드 성공 + cold-start 측정** — 사용자가 `eas build -p android --profile preview` 진행, 3회 실패를 로컬 `expo export`로 재현·해소: (1) expo-constants peer dep 누락(497397d), (2) EAS Update dynamic config 차단 + fallbackToCacheTimeout 0(5f69cb9), (3) dynamicRequire(변수)→loadOptionalModule thunk + supabase-js OTEL import patch-package(6fd8651). preview release APK(Galaxy A10) cold-start **JS-TTI 237ms** ✅ <2000ms (측정범위=JS eval→interactive, 네이티브 prefix·iOS·full number deferred). Jest 585+1skip, typecheck 0, lint 0. 로컬 expo export = release 번들 사전검증 루프 확보. **이전**: **S13 EAS Build skeleton PARTIAL ship** — 사용자 "S13 start" + Q-B20 round-trip(Apple Developer ✅ 보유 / Play Console은 APK 사이드로드로 베타엔 불필요 deferred). 스켈레톤 전체: `eas.json` 강화(environment 바인딩 + resourceClass + APK/AAB split + submit internal track) + `src/lib/perf/coldStart.ts`(D25 TTI 계측 — measure/classify/format/tracker, monotonic clock, 19 Jest TDD-first) + `app/_layout.tsx` markInteractive wire-up + `.env.eas.example`(EAS secret/env manifest A/B/C) + `.env.example` 보강(EAS_PROJECT_ID·NAVER 검색) + `docs/EAS_BUILD_RUNBOOK.md`(founder 운영 절차 + cold-start 판독). Jest 577 + 1 skip, typecheck 0, lint 0 errors. 인증서·keystore·TestFlight/Play track·실기기 cold-start 실측은 인터랙티브 eas CLI = 운영 트랙(runbook). S13 IN_PROGRESS 유지(DONE 아님). **이전**: **S16-naver-fallback PARTIAL ship** — 사용자 "Q-A2 답변 안 옴 → fallback" 지시. D1 no-answer 액션 발동([D36](DECISIONS.md#d36--s16-장소-검색-fallback--naversearchprovider-eager-q-a2-no-answer--edge-proxy)). TDD-first: `_lib/naver_local.ts`(stripHtmlTags + normalizeNaverCoord WGS84×10^7 + isPlausibleKoreaWgs84 bbox 안전망 + parse/build + fetchNaverLocal) 28 Deno + `naver_local_search/` Edge(parseSearchRequest + naverErrorToHttp + auth getUser quota 보호) 13 Deno + `PlaceSearchProvider.ts` 인터페이스(S16 Phase a) + `NaverSearchProvider.ts`(Edge invoke) 8 Jest. 네이버 secret → Edge proxy 필수(rule 7, 카카오 D26 client-direct와 다름). Deno 283 + Jest 558 + 1 skip, typecheck 0, lint 0. S10 정책 블록 해소(native/EAS gating만 잔여). 운영 prereq: NAVER_CLIENT_ID/SECRET 등록 + 좌표 format live 검증(bbox 안전망이 mismatch 조기 감지). **이전**: **S15-deeplink 정식 DONE 마무리** — 사용자 "S15 잔여작업 여기서 전부 마무리" 요청. 5 sub-task TDD-first 순차 ship: (1) S15-deeplink-edge — `_lib/fingerprint.ts` 15 Deno + `_lib/attribution.ts` 18 Deno + `attribution_click_log/` Edge + `attribution_resolve/` Edge, (2) S15-deeplink-web — `web-guest/lib/attribution.ts` 6 Jest + ClientPage `handleNicknameComplete` click_log 통합, (3) S15-deeplink-rn-fallback — `attributionApi.ts` 7 Jest + `InviteCodeModal.tsx` 11 Jest (4자리 numeric + sanitize/truncate + 확인/건너뛰기 Alert + DESIGN §17 brand-500 CTA + tabular-nums), (4) S15-deeplink-rn-conversion — `AttributionRoot.tsx` 6 Jest + `_layout.tsx::AttributionRootConnected` wire-up + onMatched Alert, (5) S15-deeplink-deeplink — `app.config.ts` ios.associatedDomains + android.intentFilters + AASA + assetlinks.json + next.config.ts headers. RN Jest 550 + 1 skip, web-guest 90, Deno 242, typecheck 0, lint 0 errors. EAS Build / TestFlight 운영 prereq(AASA TEAMID + assetlinks sha256 + ATT 모달 + PIPA + Q-A6 PoC)는 별도 트랙 명시. **이전**: **S08 정식 DONE 마무리** — 본 turn S08-ui 4 sub-task 누적(kakaoShare lib + PlaceActionSheet DESIGN §10.3 + places.queries + place screen) → S08 acceptance 6/6 close. 마커 trigger는 S10 unblock 후 wire-up 1줄(router.push)만 필요. Jest 526 + 1 skip, Deno 209, typecheck 0, lint 0 errors. **이전**: **S08-backend ship** — migration 0017_click_events.sql(table + 6 indexes + RLS) + Edge Function click_log/(parseClickLogRequest + buildClickEventRow + handler with upsert ignoreDuplicates idempotency) + src/lib/analytics/click_through.ts(DI-first logReservationClick wrapper). TDD-first 27 신규 tests(Deno 15 + Jest 12). **이전**: **S12 정식 DONE 마무리** — 본 turn 누적 3 sub-task(backend-f1-f4 + publishers-f4 + client) 위에 마지막 `_layout.tsx` mount(`PushRegistrationRoot` + `PushRegistrationConnected`) 추가. S12 acceptance 모두 close. Deno 194 + Jest 482 + 1 skip, typecheck 0, lint pre-existing 3. **이전**: S12-publishers-f4 + S12-client ship — votes_aggregate에 전원 vote detect (countUniqueVoters + isAllMembersVoted) + dispatcher.dispatch + notify_f4 handler register. `src/lib/push/expoNotifications.ts` (DI-first + dynamicRequire 어댑터). expo-notifications ~0.32 install. F4 알림 완전 wire-up. **이전**: S12-backend-f1-f4 ship — notify_f1/f2/f3/f4 + `_lib/expo_push.ts` 공통 helper (TDD-first). Q-B12 마이크로카피 auto mode 자체 결정 (founder review 대기). Deno 194 + Jest 476 + 1 skip, typecheck 0, lint pre-existing 3. **S12 acceptance 거의 close** — backend 4종 ✅ + F4 publisher ✅ + client lib ✅. F1/F2/F3 publishers (friends/invitations API supabase 전환 prereq, S07 후속) + RN `_layout.tsx` mount + 마이크로카피 founder review만 잔여. **이전**: S15-deeplink-schema turn — migration 0016 + invite_code TS helper (groups.invite_code CHAR(4) UNIQUE + generate_invite_code SQL function + BEFORE INSERT trigger + branch_attributions ip_hash/ua_hash/clicked_at 3컬럼 + 2 partial indexes. inviteCode.ts 21 Jest tests TDD-first). 다음 sub-task: S15-deeplink-edge (attribution_match Edge Function). **이전**: fail-cleanup turn — 14개 fail/skip/deferred 일괄 처리 + S11 정식 DONE. Phase A 순차: (1) lint 12 errors→0 + warnings 8412→0, (2) expo-image-picker install + typecheck fix, (3) Deno CLI 2.8.0 install + 143 Edge tests 실행 → group_confirm test bug 1개 발견·fix, (4) votes unique index 0014 + api.ts 23505 graceful, (5) reset_my_stalled_calendar_retries RPC 0015 + ReauthModal wire-up, (6) fetchUserVotes + S05-screen-confirm seed (queries 4 신규 tests), (7) expo-auth-session + expo-calendar install (setup.ts wiring은 Google OAuth dev key prereq라 EAS Build 트랙 deferred 명시). **S11 정식 DONE 검증** — tokens/theme/typography/Pretendard WOFF2/Lucide 모두 ready, 다크 디테일은 D2 deferred 유지. 최종 Jest 446 + 1 skip, Deno 143 + 0 fail, typecheck 0, lint 0
- **다음 update**: S19 (내 모임 리스트 — fetchMyGroups + 홈 '다가오는 모임' 실데이터 + 카드→그리드 navigation, Lane E 척추 2번째) / EAS Build 트랙 (Google OAuth dev key + expo packages production wiring + AASA TEAMID + assetlinks sha256 + ATT 모달 + TestFlight Universal Links 실기기 검증) / S15-mapmode (S10 native 트랙 후) / S17 QA 종합 / S13 EAS skeleton
