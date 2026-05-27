# Progress — Phase 1+2

> Phase 1+2 빌드·출시 burn-down + Gate 측정 추적.
> `/ship-task` 시 카운트 자동 +1. Gate 측정 시작 후 weekly update.

---

## 📊 Build Burn-down

**Phase 1+2 timeline**: 3.5주 (2026-05-22 기준, Sprint 0 진행 중)

| Sprint | 기간 | 계획 deliverable | 실제 진행 | 상태 |
|---|---|---|---|---|
| **Sprint 0** | W-1 (2026-05-22 ~ 2026-05-28) | 12 인프라 항목 + 디자인 자산 | Expo init + Supabase + EAS Build + 카카오 portal + Supabase Auth Kakao + 키해시 등록 완료 | ON_TRACK |
| **Sprint 1** | W0 | S00, S11, S13 skeleton | S00 ✅, **S11 ✅ (백필 2026-05-26, 다크 검증 deferred)**, S13 eas.json (S01 portfolio) | DONE (S00·S11) |
| **Sprint 2** | W1 | S01 + S10 + S14 병행 (★ Kakao 답변 review) | **S01 ✅** (D29), **S14 ✅ DONE 2026-05-26** (skeleton + utils + test-augment + violations-fix + e2e-setup + e2e-full-fix + e2e-residual + cross-day-sweep — Jest 84 + Playwright 18, 일체 0 skip), S10 BLOCKED (Q-A2), **UI-§17 ✅ 2026-05-26** | IN_PROGRESS (S10 BLOCKED) |
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
| **B (Map·Click-through·지도-일정)** | 1 (S15-mapmode) | 0 | 1 (S08) | 1 (S10) |
| **C (Web guest)** | 0 | 0 | 2 (S14, S15-deeplink) | 0 |
| **D (Cross-cutting)** | 1 (S17) | 1 (S13 eas.json) | 3 (S06, S11, S12) | 1 (S16) |

세부: [TASK_BACKLOG.md](TASK_BACKLOG.md)

---

## 🎯 Active Gates

### D1 — Kakao Local API 정책 답변 (W1 deadline, auth 부분은 D29로 해소)
- **마감**: 2026-05-28 (D-6)
- **상태**: 지도 부분(Q-A2)만 답변 대기 중. Auth 부분(Q-A1)은 D29 채택으로 closed (2026-05-22)
- **블록 대상**: S10, S16 (지도) 활성 여부. S01은 D29로 BLOCKED 해소
- **No-answer 시 액션**: S16의 NaverSearchProvider eager 활성. S01은 영향 없음

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
| Cold start < 2초 | iOS+Android × 저사양·중사양 | — | S13 EAS production binary |
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

---

## 📅 마지막 업데이트

- **날짜**: 2026-05-27
- **업데이트한 사람**: **S15-deeplink 정식 DONE 마무리** — 사용자 "S15 잔여작업 여기서 전부 마무리" 요청. 5 sub-task TDD-first 순차 ship: (1) S15-deeplink-edge — `_lib/fingerprint.ts` 15 Deno + `_lib/attribution.ts` 18 Deno + `attribution_click_log/` Edge + `attribution_resolve/` Edge, (2) S15-deeplink-web — `web-guest/lib/attribution.ts` 6 Jest + ClientPage `handleNicknameComplete` click_log 통합, (3) S15-deeplink-rn-fallback — `attributionApi.ts` 7 Jest + `InviteCodeModal.tsx` 11 Jest (4자리 numeric + sanitize/truncate + 확인/건너뛰기 Alert + DESIGN §17 brand-500 CTA + tabular-nums), (4) S15-deeplink-rn-conversion — `AttributionRoot.tsx` 6 Jest + `_layout.tsx::AttributionRootConnected` wire-up + onMatched Alert, (5) S15-deeplink-deeplink — `app.config.ts` ios.associatedDomains + android.intentFilters + AASA + assetlinks.json + next.config.ts headers. RN Jest 550 + 1 skip, web-guest 90, Deno 242, typecheck 0, lint 0 errors. EAS Build / TestFlight 운영 prereq(AASA TEAMID + assetlinks sha256 + ATT 모달 + PIPA + Q-A6 PoC)는 별도 트랙 명시. **이전**: **S08 정식 DONE 마무리** — 본 turn S08-ui 4 sub-task 누적(kakaoShare lib + PlaceActionSheet DESIGN §10.3 + places.queries + place screen) → S08 acceptance 6/6 close. 마커 trigger는 S10 unblock 후 wire-up 1줄(router.push)만 필요. Jest 526 + 1 skip, Deno 209, typecheck 0, lint 0 errors. **이전**: **S08-backend ship** — migration 0017_click_events.sql(table + 6 indexes + RLS) + Edge Function click_log/(parseClickLogRequest + buildClickEventRow + handler with upsert ignoreDuplicates idempotency) + src/lib/analytics/click_through.ts(DI-first logReservationClick wrapper). TDD-first 27 신규 tests(Deno 15 + Jest 12). **이전**: **S12 정식 DONE 마무리** — 본 turn 누적 3 sub-task(backend-f1-f4 + publishers-f4 + client) 위에 마지막 `_layout.tsx` mount(`PushRegistrationRoot` + `PushRegistrationConnected`) 추가. S12 acceptance 모두 close. Deno 194 + Jest 482 + 1 skip, typecheck 0, lint pre-existing 3. **이전**: S12-publishers-f4 + S12-client ship — votes_aggregate에 전원 vote detect (countUniqueVoters + isAllMembersVoted) + dispatcher.dispatch + notify_f4 handler register. `src/lib/push/expoNotifications.ts` (DI-first + dynamicRequire 어댑터). expo-notifications ~0.32 install. F4 알림 완전 wire-up. **이전**: S12-backend-f1-f4 ship — notify_f1/f2/f3/f4 + `_lib/expo_push.ts` 공통 helper (TDD-first). Q-B12 마이크로카피 auto mode 자체 결정 (founder review 대기). Deno 194 + Jest 476 + 1 skip, typecheck 0, lint pre-existing 3. **S12 acceptance 거의 close** — backend 4종 ✅ + F4 publisher ✅ + client lib ✅. F1/F2/F3 publishers (friends/invitations API supabase 전환 prereq, S07 후속) + RN `_layout.tsx` mount + 마이크로카피 founder review만 잔여. **이전**: S15-deeplink-schema turn — migration 0016 + invite_code TS helper (groups.invite_code CHAR(4) UNIQUE + generate_invite_code SQL function + BEFORE INSERT trigger + branch_attributions ip_hash/ua_hash/clicked_at 3컬럼 + 2 partial indexes. inviteCode.ts 21 Jest tests TDD-first). 다음 sub-task: S15-deeplink-edge (attribution_match Edge Function). **이전**: fail-cleanup turn — 14개 fail/skip/deferred 일괄 처리 + S11 정식 DONE. Phase A 순차: (1) lint 12 errors→0 + warnings 8412→0, (2) expo-image-picker install + typecheck fix, (3) Deno CLI 2.8.0 install + 143 Edge tests 실행 → group_confirm test bug 1개 발견·fix, (4) votes unique index 0014 + api.ts 23505 graceful, (5) reset_my_stalled_calendar_retries RPC 0015 + ReauthModal wire-up, (6) fetchUserVotes + S05-screen-confirm seed (queries 4 신규 tests), (7) expo-auth-session + expo-calendar install (setup.ts wiring은 Google OAuth dev key prereq라 EAS Build 트랙 deferred 명시). **S11 정식 DONE 검증** — tokens/theme/typography/Pretendard WOFF2/Lucide 모두 ready, 다크 디테일은 D2 deferred 유지. 최종 Jest 446 + 1 skip, Deno 143 + 0 fail, typecheck 0, lint 0
- **다음 update**: EAS Build 트랙 (Google OAuth dev key + expo packages production wiring + AASA TEAMID + assetlinks sha256 + ATT 모달 + TestFlight Universal Links 실기기 검증) / S15-mapmode (S10 BLOCKED unblock 후) / S17 QA 종합 / S13 EAS skeleton
