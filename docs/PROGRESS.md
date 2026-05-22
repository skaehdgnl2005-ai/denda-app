# Progress — Phase 1+2

> Phase 1+2 빌드·출시 burn-down + Gate 측정 추적.
> `/ship-task` 시 카운트 자동 +1. Gate 측정 시작 후 weekly update.

---

## 📊 Build Burn-down

**Phase 1+2 timeline**: 3.5주 (2026-05-22 기준, Sprint 0 진행 중)

| Sprint | 기간 | 계획 deliverable | 실제 진행 | 상태 |
|---|---|---|---|---|
| **Sprint 0** | W-1 (2026-05-22 ~ 2026-05-28) | 12 인프라 항목 + 디자인 자산 | Expo init + Supabase scaffolding 완료 | ON_TRACK |
| **Sprint 1** | W0 | S00, S11, S13 skeleton | S00 ✅ (DONE) | IN_PROGRESS |
| **Sprint 2** | W1 | S01 + S10 + S14 병행 (★ Kakao 답변 review) | 미시작 | — |
| **Sprint 3** | W2 | S05 + S07 + S03 + S08 (baseline 시작) | 미시작 | — |
| **Sprint 4** | W3 | S04 + S06 + S12 + S15 (TestFlight) | 미시작 | — |
| **W3.5** | W3.5 | S17 QA 종합 + 안암 invite-only launch | 미시작 | — |

---

## 📈 Task 진척

**총 17 태스크 (S00 ~ S16) + S17 QA**

```
Progress: █▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ 1 / 17 (5.9%)
```

| Lane | TODO | IN_PROGRESS | DONE | BLOCKED |
|---|---|---|---|---|
| **A (Foundation·Auth·Time grid·OCR)** | 4 | 0 | 1 | 1 (S01) |
| **B (Map·Click-through·지도-일정)** | 2 | 0 | 0 | 1 (S10) |
| **C (Web guest)** | 2 | 0 | 0 | 0 |
| **D (Cross-cutting)** | 6 | 0 | 0 | 1 (S16) |

세부: [TASK_BACKLOG.md](TASK_BACKLOG.md)

---

## 🎯 Active Gates

### D1 — Kakao 정책 답변 (W1 deadline)
- **마감**: 2026-05-28 (D-6)
- **상태**: 답변 대기 중 (문의 발송: 2026-05-21)
- **블록 대상**: S01, S10, S16 활성 여부
- **No-answer 시 액션**: 즉시 S16 (backup providers) eager 활성. Sprint 2 일정 재조정

→ [DECISIONS.md#d1](DECISIONS.md#d1--kakao-oauth--local-api-정책-verify-track--lazy-backup) | [OPEN_QUESTIONS.md#q-a1](OPEN_QUESTIONS.md#q-a1--kakao-비즈앱-우회-oauth-정책-답변)

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
| W0 (Sprint 1) | — | — | |
| W1 (Sprint 2) | — | — | ★ Kakao gate |
| W2 (Sprint 3) | — | — | baseline 시작 |
| W3 (Sprint 4) | — | — | TestFlight |
| W3.5 | — | — | Launch |

---

## 📅 마지막 업데이트

- **날짜**: 2026-05-22
- **업데이트한 사람**: S00 ship-task (Backend Foundation)
- **다음 update**: S11 또는 S13 ship 시
