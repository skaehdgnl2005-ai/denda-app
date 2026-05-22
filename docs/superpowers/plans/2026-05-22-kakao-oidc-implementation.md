# Kakao OIDC 채택 (D29) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** D21 (synthetic email + HMAC 우회) 정책·코드·migration·harness 전체를 D29 (Kakao OIDC + Supabase `signInWithIdToken`)로 교체. 정책 SSoT(`DECISIONS.md`) → 영향받는 docs → harness rules/skills/agents → migration 0003 amend → 미사용 코드 삭제 → orphan reference 검증 순서.

**Architecture:** 8 task atomic-commit chain. 각 task = 1 commit. 정책 docs(SSoT 핵심) 먼저 → 파생 docs → harness 설정 → schema migration → code purge → 최종 grep 검증. Migration은 `0001_initial.sql`을 amend하는 `0003_kakao_oidc_amend.sql` (0002_rls는 이미 존재).

**Tech Stack:** Markdown edit (docs), SQL DDL (migration), Deno TypeScript (Edge Function), Grep (verification).

**Spec source:** [docs/superpowers/specs/2026-05-22-kakao-oidc-design.md](../specs/2026-05-22-kakao-oidc-design.md) (commit `969bcd3`).

---

## File Structure 개요

| Task | 파일 | 책임 |
|---|---|---|
| 1 | `docs/DECISIONS.md`, `docs/OPEN_QUESTIONS.md`, `docs/PROJECT_CONTEXT.md`, `docs/PROGRESS.md` | 정책 SSoT 결정 변경 (D21 supersede, D29 신규, D1 본문, Q-A1 close, BLOCKED count) |
| 2 | `docs/ARCHITECTURE.md` | 시스템 다이어그램·users 테이블·§3.1 Kakao OAuth flow 전체 재작성 |
| 3 | `docs/TASK_BACKLOG.md`, `docs/PRD.md`, `docs/TEST_PLAN.md` | S01 acceptance rewrite, Sprint 0 체크리스트 추가, PRD scope 참조, test fixture 이름 |
| 4 | `.claude/rules/supabase.md`, `.claude/rules/react-native.md`, `.claude/agents/reviewer.md`, `.claude/skills/start-task/SKILL.md` | Harness 정책 — API key 표·AuthProvider line·reviewer secret check·태스크 진입 가이드 |
| 5 | `.env.example`, `supabase/migrations/0002_rls.sql` (comment only) | HMAC_SECRET 용도 재정의 (D21→D28), 0002 헤더 comment cleanup |
| 6 | `supabase/migrations/0003_kakao_oidc_amend.sql` (신규) | `synthetic_email` DROP, `email` nullable ADD, `handle_new_auth_user` trigger 재작성 |
| 7 | `supabase/functions/kakao_login/` (삭제), `supabase/functions/_lib/hmac.ts` | Edge Function 통째 삭제, hmac.ts에서 `syntheticEmail()` 함수만 삭제 (해시 utility는 D28 fingerprint에 재사용) |
| 8 | (verification grep만 — 변경 없음) | 모든 orphan reference 제거 확인 |

**Out of scope (이 plan 종료 후 별도 흐름):**
- `src/lib/auth/KakaoOIDCProvider.ts` 구현 — `/start-task S01` 흐름에서 처리
- Supabase Auth dashboard에서 Kakao provider 활성화 — Sprint 0 인프라 체크리스트 (수동 작업)
- Kakao 디벨로퍼스 portal OpenID Connect 활성화 — Sprint 0 인프라 체크리스트 (수동 작업)
- Migration 실제 적용 (`supabase db push`) — 사용자 환경에서 수동 실행

---

## Task 1: 정책 SSoT 결정 변경 (DECISIONS · OPEN_QUESTIONS · PROJECT_CONTEXT · PROGRESS)

**Files:**
- Modify: `docs/DECISIONS.md` (D21 supersede header + D29 신규 절 + D1 본문 update)
- Modify: `docs/OPEN_QUESTIONS.md` (Q-A1 Closed by D29)
- Modify: `docs/PROJECT_CONTEXT.md:25` (§3 P0 카카오 OAuth 참조) + `:110` (§8 users 테이블)
- Modify: `docs/PROGRESS.md` (BLOCKED count 2→1, D1 gate description)

---

- [ ] **Step 1.1: DECISIONS.md — D21 헤더에 Superseded marker 추가**

`docs/DECISIONS.md` line 568 부근, 다음 부분을 찾아:

```markdown
## D21 — Kakao OAuth synthetic email + HMAC (베타는 카카오 only)
```

다음으로 교체:

```markdown
## D21 — Kakao OAuth synthetic email + HMAC (베타는 카카오 only) ⚠️ Superseded by D29 (2026-05-22)

> **이 결정은 폐기되었습니다.** 카카오 비즈앱 우회 OAuth 대신 표준 OIDC + `supabase.auth.signInWithIdToken`을 채택. 본문은 이력 보존을 위해 그대로 둠.
```

본문(`| 항목 | 내용 |` 표) 그대로 보존.

- [ ] **Step 1.2: DECISIONS.md — D29 신규 절 추가**

`docs/DECISIONS.md` 가장 아래(D28 다음, 파일 끝부분)에 다음 추가:

```markdown

---

## D29 — Kakao OIDC OAuth via Supabase signInWithIdToken (D21 supersede)

| 항목 | 내용 |
|---|---|
| 결정 | 카카오 OIDC 표준 OAuth + `supabase.auth.signInWithIdToken({ provider: 'kakao', token: id_token, nonce })`. 베타는 `scope=openid profile_nickname`만 요청 (비-비즈앱 가능). 비즈앱 등록 + `account_email` scope 추가는 Phase 3 진입 시점 (Gate #2 ≥ 25% 통과). D21 (synthetic email + HMAC) 폐기, `supabase/functions/kakao_login/` 삭제, `users.synthetic_email` 컬럼 제거. |
| 근거 | (1) Supabase가 카카오를 native id_token provider로 공식 지원 — 자체 검증·HMAC 구현 제거 (2) 카카오 OIDC 표준 flow는 정책 회색지대 없음 — Q-A1 답변 의존 해소 (3) `account_email` consent만 비즈앱 제약이라 베타에서 이메일 미수신 trade-off로 비즈앱 신청을 Phase 3에 align (사업자등록·토스 가맹 심사와 동기) (4) D21 채택 결정일(2026-05-21) 이후 1일 만에 사용자가 정석 경로 선호 명시 |
| 대안 | (a) D21 유지 — Q-A1 답변 지연·표준 이탈 risk (b) 베타에서 비즈앱 즉시 등록 — 사업자등록 timing 압박·launch 1-2주 지연 risk |
| 의존 | Sprint 0 인프라 체크리스트: 카카오 디벨로퍼스 portal에서 OpenID Connect 활성화 + Supabase Auth dashboard에서 Kakao provider Enable. 둘 다 수동 작업, founder 소유 |
| 결정일 | 2026-05-22 |
| 영향 | S01 BLOCKED → TODO, Q-A1 Closed, D1 결정 본문 (auth 부분만) update, `supabase/functions/kakao_login/` 삭제, `users.synthetic_email` DROP (migration 0003), HMAC secret 용도 변경 (D21 → D28 fingerprint salt) |
| Phase 3 전환 | 비즈앱 신청 → 승인 → `account_email` scope 추가 → 기존 user 재로그인 시 `auth.users.email` 자동 채움. Schema 변경 불필요 (`email` 이미 nullable) |
| 출처 | docs/superpowers/specs/2026-05-22-kakao-oidc-design.md, 사용자 결정 2026-05-22 |
```

- [ ] **Step 1.3: DECISIONS.md — D1 결정·영향 본문 update**

`docs/DECISIONS.md` line 19, "결정" 행을 찾아:

```markdown
| 결정 | Kakao 비즈앱 우회 OAuth (synthetic email + HMAC) + Kakao Local API on Naver Maps를 baseline으로 진행하되, 동시에 backup 인터페이스를 추상화 |
```

다음으로 교체:

```markdown
| 결정 | Kakao OIDC native OAuth (Supabase `signInWithIdToken` — [D29](#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede)) + Kakao Local API on Naver Maps를 baseline으로 진행하되, 동시에 backup 인터페이스를 추상화 |
```

같은 D1 표 line 26, "결과 영향" 행:

```markdown
| 결과 영향 | S01 (Auth) baseline 가능. Step 16은 lazy interface 추상화만. Apple 심사 시 Apple ID 추가는 Phase 3 |
```

다음으로 교체:

```markdown
| 결과 영향 | S01 (Auth) baseline = D29 OIDC 표준 (Q-A1 closed). S10 (Map) baseline = Kakao Local API (Q-A2 답변 대기). Step 16은 lazy interface 추상화만. Apple 심사 시 Apple ID 추가는 Phase 3 |
```

- [ ] **Step 1.4: OPEN_QUESTIONS.md — Q-A1 close**

`docs/OPEN_QUESTIONS.md` line 10-16 부근, Q-A1 항목 전체:

```markdown
### Q-A1 — Kakao 비즈앱 우회 OAuth 정책 답변
- **출처**: V2_PRD §16-1, OFFICE_HOURS §13, ENG_REVIEW §1.2
- **질문**: synthetic email + HMAC OAuth가 Kakao 정책 위반 아닌지 서면 확인
- **소유자**: Founder
- **마감**: 2026-05-28 (D1 W1 deadline)
- **해결 시**: D21 확정 / 미수신 시 → Apple ID OAuth eager fallback (S16)
- **상태**: 진행 중 (Kakao 디벨로퍼스 1:1 문의 발송)
```

다음으로 교체:

```markdown
### Q-A1 — Kakao 비즈앱 우회 OAuth 정책 답변 ✅ Closed by D29 (2026-05-22)
- **출처**: V2_PRD §16-1, OFFICE_HOURS §13, ENG_REVIEW §1.2
- **질문**: synthetic email + HMAC OAuth가 Kakao 정책 위반 아닌지 서면 확인
- **소유자**: Founder
- **마감**: 2026-05-28 (D1 W1 deadline) — 무의미해짐
- **해결**: D29 채택으로 비즈앱 우회 OAuth 자체를 사용하지 않음. 표준 OIDC + Supabase `signInWithIdToken` 사용. 카카오 정책 답변 의존 해소. S01 BLOCKED 해소
- **상태**: Closed (2026-05-22)
```

- [ ] **Step 1.5: PROJECT_CONTEXT.md — §3 P0 list update**

`docs/PROJECT_CONTEXT.md` line 25:

```markdown
- 카카오 OAuth (D21 synthetic email + HMAC)
```

교체:

```markdown
- 카카오 OAuth ([D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede) OIDC + Supabase signInWithIdToken)
```

- [ ] **Step 1.6: PROJECT_CONTEXT.md — §8 users 테이블 update**

`docs/PROJECT_CONTEXT.md` line 110:

```markdown
- `users` (kakao_id, synthetic_email)
```

교체:

```markdown
- `users` (kakao_id, email — nullable, Phase 3 비즈앱 후 채움)
```

- [ ] **Step 1.7: PROGRESS.md — BLOCKED count update**

`docs/PROGRESS.md` line 33, A lane 행:

```markdown
| **A (Foundation·Auth·Time grid·OCR)** | 4 | 0 | 1 | 1 (S01) |
```

교체:

```markdown
| **A (Foundation·Auth·Time grid·OCR)** | 5 | 0 | 1 | 0 |
```

(S01 BLOCKED → TODO로 이동했으므로 BLOCKED 0, TODO +1)

- [ ] **Step 1.8: PROGRESS.md — D1 active gate description update**

`docs/PROGRESS.md` line 44-50, Active Gates 절의 D1 항목:

```markdown
### D1 — Kakao 정책 답변 (W1 deadline)
- **마감**: 2026-05-28 (D-6)
- **상태**: 답변 대기 중 (문의 발송: 2026-05-21)
- **블록 대상**: S01, S10, S16 활성 여부
- **No-answer 시 액션**: 즉시 S16 (backup providers) eager 활성. Sprint 2 일정 재조정

→ [DECISIONS.md#d1](DECISIONS.md#d1--kakao-oauth--local-api-정책-verify-track--lazy-backup) | [OPEN_QUESTIONS.md#q-a1](OPEN_QUESTIONS.md#q-a1--kakao-비즈앱-우회-oauth-정책-답변)
```

교체:

```markdown
### D1 — Kakao Local API 정책 답변 (W1 deadline, auth 부분은 D29로 해소)
- **마감**: 2026-05-28 (D-6)
- **상태**: 지도 부분(Q-A2)만 답변 대기 중. Auth 부분(Q-A1)은 D29 채택으로 closed (2026-05-22)
- **블록 대상**: S10, S16 (지도) 활성 여부. S01은 D29로 BLOCKED 해소
- **No-answer 시 액션**: S16의 NaverSearchProvider eager 활성. S01은 영향 없음

→ [DECISIONS.md#d1](DECISIONS.md#d1--kakao-oauth--local-api-정책-verify-track--lazy-backup) | [OPEN_QUESTIONS.md#q-a2](OPEN_QUESTIONS.md#q-a2--kakao-local-api-약관-외부-지도-sdk-위-표시) | [DECISIONS.md#d29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede)
```

- [ ] **Step 1.9: 변경 verify**

Run: `git diff --stat docs/DECISIONS.md docs/OPEN_QUESTIONS.md docs/PROJECT_CONTEXT.md docs/PROGRESS.md`

Expected: 4개 파일 모두 modification 표시, insertions 합계 ~40 lines, deletions ~15 lines.

- [ ] **Step 1.10: Commit**

```bash
git add docs/DECISIONS.md docs/OPEN_QUESTIONS.md docs/PROJECT_CONTEXT.md docs/PROGRESS.md
git commit -m "$(cat <<'EOF'
docs: D29 — Kakao OIDC supersede D21 (decision SSoT + index)

D21 (synthetic email + HMAC 우회) → D29 (Kakao OIDC + Supabase
signInWithIdToken). 비즈앱 등록 부담은 Phase 3로 이연 (account_email scope만
비즈앱 제약). Q-A1 closed, D1 본문에서 auth track 분리, PROGRESS BLOCKED 카운트
2→1로 감소.

Spec: docs/superpowers/specs/2026-05-22-kakao-oidc-design.md (969bcd3)
User 승인: 2026-05-22.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: ARCHITECTURE.md — 시스템 다이어그램 + users 테이블 + §3.1 auth flow

**Files:**
- Modify: `docs/ARCHITECTURE.md:17` (§1 시스템 구성도 Auth 라벨)
- Modify: `docs/ARCHITECTURE.md:40` (§2 users 테이블 row)
- Modify: `docs/ARCHITECTURE.md:72-105` (§3.1 Kakao OAuth flow 전체)

---

- [ ] **Step 2.1: §1 시스템 구성도 Auth 라벨**

`docs/ARCHITECTURE.md` line 17:

```markdown
     ├── [Auth (synthetic email + HMAC)]          ← D21
```

교체:

```markdown
     ├── [Auth (Kakao OIDC + signInWithIdToken)]  ← D29
```

- [ ] **Step 2.2: §2 users 테이블 row**

`docs/ARCHITECTURE.md` line 40:

```markdown
| `users` | id, kakao_id, synthetic_email, nickname, phone, created_at | [D21](DECISIONS.md#d21--kakao-oauth-synthetic-email--hmac-베타는-카카오-only) synthetic email |
```

교체:

```markdown
| `users` | id, kakao_id, email (nullable), nickname, phone, created_at | [D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede) OIDC. email은 Phase 3 비즈앱 등록 + `account_email` scope 후 채움 |
```

- [ ] **Step 2.3: §3.1 전체 절 재작성**

`docs/ARCHITECTURE.md` line 72-105 (절 헤더부터 다음 절 §3.2 직전까지) 전체:

```markdown
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
```

이 전체 절(line 72-105)을 다음으로 교체:

```markdown
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
```

- [ ] **Step 2.4: 변경 verify**

Run grep on the file to confirm D21 reference 사라짐 (단 §3.1 절 헤더가 D29로 바뀐 것 외에는 잔재 없음):

```bash
grep -n "synthetic_email\|kakao_login\|D21" "c:/dev/된다 앱/docs/ARCHITECTURE.md"
```

Expected: empty output (또는 결과 없음).

- [ ] **Step 2.5: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "$(cat <<'EOF'
docs(architecture): §3.1 Kakao OIDC flow (D29 supersede D21)

시스템 구성도 Auth 라벨, §2 users 테이블 컬럼, §3.1 OAuth flow 전체를
Supabase signInWithIdToken 기반으로 재작성. handle_new_auth_user trigger
명세 포함.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: TASK_BACKLOG.md + PRD.md + TEST_PLAN.md

**Files:**
- Modify: `docs/TASK_BACKLOG.md` (S01 acceptance rewrite, Sprint 0 checklist 추가, 진행 현황 카운트)
- Modify: `docs/PRD.md:843` (auth scope 참조)
- Modify: `docs/TEST_PLAN.md:311` (kakao_oauth.yaml description)

---

- [ ] **Step 3.1: TASK_BACKLOG.md — 진행 현황 요약 update**

`docs/TASK_BACKLOG.md` line 9-16, "진행 현황 요약" 절:

```markdown
- **총 17 태스크** (S00 ~ S16)
- **DONE**: 1 (S00)
- **IN_PROGRESS**: 0
- **TODO**: 14
- **BLOCKED**: 2 (S01, S10 — D1 답변 대기)
```

교체:

```markdown
- **총 17 태스크** (S00 ~ S16)
- **DONE**: 1 (S00)
- **IN_PROGRESS**: 0
- **TODO**: 15
- **BLOCKED**: 1 (S10 — D1 지도 부분 답변 대기. S01은 D29 채택으로 unblocked)
```

- [ ] **Step 3.2: TASK_BACKLOG.md — Sprint 마일스톤 W1 deadline 본문**

`docs/TASK_BACKLOG.md` line 27, Sprint 2 행:

```markdown
| **Sprint 2** | W1 | S01 (auth) + S10 (map) + S14 (web guest) 병행 시작. Branch.io PoC | **★ W1 deadline: Kakao 답변 review. No-answer → S16 eager 활성** |
```

교체:

```markdown
| **Sprint 2** | W1 | S01 (auth, D29 OIDC) + S10 (map) + S14 (web guest) 병행 시작. Attribution 자체 구축 PoC | **★ W1 deadline: Kakao Local API 답변 review (auth는 D29로 해소). No-answer → NaverSearchProvider eager 활성** |
```

- [ ] **Step 3.3: TASK_BACKLOG.md — S01 acceptance 전체 재작성**

`docs/TASK_BACKLOG.md` line 52-65, S01 태스크 블록 전체:

```markdown
### S01 — Kakao OAuth (synthetic email + HMAC)

- **Status**: BLOCKED (Q-A1) | **Owner**: Backend + Mobile | **Sprint**: 2 | **Lane**: A
- **Depends**: S00, **D1 W1 deadline** (2026-05-28)
- **Acceptance**:
  - Kakao SDK 통합 + access_token 받기
  - Edge Function: `kakao_login` (validate token → synthetic email `kakao_{id}@denda.synthetic` → HMAC → `supabase.auth.signUp`)
  - 약관·개인정보 동의 모달 (V2_PRD §5.1)
  - 3-슬라이드 온보딩
  - 재로그인 (기존 user 매칭) + Token refresh
  - `AuthProvider` interface 추상화 (S16 fallback 대비)
- **Files**: `src/lib/auth/kakao.ts`, `src/lib/auth/AuthProvider.ts`, `supabase/functions/kakao_login/`, `src/screens/onboarding/`
- **Worktree 분기**: 가능 (S03 OCR + S07 친구는 S01과 병행 worktree 가능)
- **Notes**: 7.2 ASCII flow 참조
```

교체:

```markdown
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
```

- [ ] **Step 3.4: TASK_BACKLOG.md — Sprint 0 체크리스트 추가 항목**

`docs/TASK_BACKLOG.md` line 306-322, Sprint 0 체크리스트에서 다음 라인을 찾아:

```markdown
- [ ] **Kakao 정책 재확인 2건** (Q-A1, Q-A2 — D1 답변 대기) **CRITICAL BLOCKER**
- [x] 새 Supabase project 생성 + RLS skeleton (S00 prep) — schema·RLS·scaffolding 코드 완료 (deploy는 사용자)
```

다음으로 교체 (Q-A1 부분 closed + 신규 항목 1개 추가):

```markdown
- [ ] **Kakao Local API 정책 답변 1건** (Q-A2 — D1 W1 deadline) **CRITICAL BLOCKER**. Q-A1 (auth)는 [D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede) closed.
- [ ] **Kakao OIDC + Supabase Auth provider 활성화** ([D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede)) — 카카오 portal: 앱 설정 → 카카오 로그인 → OpenID Connect 활성화 ON + `profile_nickname` 동의항목 필수. Supabase dashboard: Authentication → Providers → Kakao Enable + REST API key. 스모크 테스트로 1회 로그인 → `auth.users` 행 생성 확인
- [x] 새 Supabase project 생성 + RLS skeleton (S00 prep) — schema·RLS·scaffolding 코드 완료 (deploy는 사용자)
```

- [ ] **Step 3.5: PRD.md auth scope 참조**

`docs/PRD.md` line 843:

```markdown
- 카카오 OAuth (synthetic email + HMAC) — [D21](DECISIONS.md#d21--kakao-oauth-synthetic-email--hmac-베타는-카카오-only). [D1](DECISIONS.md#d1--kakao-oauth--local-api-정책-verify-track--lazy-backup) verify-track 진행 중
```

교체:

```markdown
- 카카오 OIDC OAuth (Supabase signInWithIdToken) — [D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede). [D21](DECISIONS.md#d21--kakao-oauth-synthetic-email--hmac-베타는-카카오-only) supersede (2026-05-22). 비즈앱 등록 + `account_email`은 Phase 3
```

- [ ] **Step 3.6: TEST_PLAN.md kakao_oauth.yaml 설명**

`docs/TEST_PLAN.md` line 311:

```markdown
4. `kakao_oauth.yaml` — D21 synthetic email + HMAC flow
```

교체:

```markdown
4. `kakao_oauth.yaml` — D29 OIDC + Supabase signInWithIdToken flow (scope=openid+profile_nickname, nonce 검증, `on_auth_user_created` trigger를 통한 public.users 동기화)
```

- [ ] **Step 3.7: 변경 verify**

Run:

```bash
grep -n "synthetic_email\|synthetic email\|HMAC" "c:/dev/된다 앱/docs/TASK_BACKLOG.md" "c:/dev/된다 앱/docs/PRD.md" "c:/dev/된다 앱/docs/TEST_PLAN.md"
```

Expected: empty output.

- [ ] **Step 3.8: Commit**

```bash
git add docs/TASK_BACKLOG.md docs/PRD.md docs/TEST_PLAN.md
git commit -m "$(cat <<'EOF'
docs: TASK_BACKLOG/PRD/TEST_PLAN — D29 Kakao OIDC references

S01 acceptance rewrite (Status: BLOCKED→TODO, Files·Depends·Notes 정리),
Sprint 0 체크리스트에 Kakao OIDC + Supabase provider 활성화 항목 추가,
진행 현황 카운트 update (BLOCKED 2→1, TODO 14→15), PRD §13.1·TEST_PLAN §3.2
auth scope 참조 D21→D29.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Harness layer (.claude/rules + agents + skills)

**Files:**
- Modify: `.claude/rules/supabase.md:73-79` (API key 표)
- Modify: `.claude/rules/react-native.md:66-68` (API key + AuthProvider line)
- Modify: `.claude/agents/reviewer.md:42` (secret check)
- Modify: `.claude/skills/start-task/SKILL.md:98` (S01 진입 가이드)

---

- [ ] **Step 4.1: rules/supabase.md API key 표 update**

`.claude/rules/supabase.md` line 71-79, "## API key 보안" 절의 표:

```markdown
| Key | 위치 |
|---|---|
| Kakao OAuth secret (HMAC) | Edge Function only |
| Kakao Local API key | Edge Function only (proxy Phase 1+2 미도입 — [Q-B8](../../docs/OPEN_QUESTIONS.md#q-b8)) |
| Naver Map SDK key | 클라이언트 (SDK 한계, public expose 인정) |
| Gemini Vision key | Edge Function only |
| Google Calendar OAuth | 클라이언트 동의 후 token은 SecureStore |
| Branch.io key | 클라이언트 + 서버 양쪽 |
| HMAC secret | Supabase secret (환경변수) |
```

교체:

```markdown
| Key | 위치 |
|---|---|
| Kakao REST API key | Supabase Auth dashboard (Kakao OIDC provider 설정). 클라이언트는 `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY`만 |
| Kakao Native app key | 클라이언트 (`EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY` — Kakao SDK 초기화용, public 인정) |
| Kakao Admin key | Edge Function only (`KAKAO_ADMIN_KEY` — Local API server proxy 도입 시. Phase 1+2 미사용) |
| Kakao Local API key | Edge Function only (proxy Phase 1+2 미도입 — [Q-B8](../../docs/OPEN_QUESTIONS.md#q-b8)) |
| Naver Map SDK key | 클라이언트 (SDK 한계, public expose 인정) |
| Gemini Vision key | Edge Function only |
| Google Calendar OAuth | 클라이언트 동의 후 token은 SecureStore |
| HMAC secret (D28 fingerprint salt) | Supabase secret (환경변수). [D29](../../docs/DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede) 이후 D21 용도 종료, D28 자체 deferred deep link fingerprint 해시에 재사용 |
```

(D21 HMAC OAuth 행 삭제, Kakao key 종류 명확화, HMAC secret 용도 D28로 재정의)

- [ ] **Step 4.2: rules/supabase.md 디렉토리 트리 참조 update**

`.claude/rules/supabase.md` line 67:

```markdown
상세 트리: [ARCHITECTURE.md §3](../../docs/ARCHITECTURE.md) (supabase/migrations, functions/_lib·kakao_login·votes_aggregate·group_confirm·notify_f1~f5·calendar_push·click_log·branch_attribution·ocr_everytime, tests)
```

교체 (`kakao_login` 제거):

```markdown
상세 트리: [ARCHITECTURE.md §3](../../docs/ARCHITECTURE.md) (supabase/migrations, functions/_lib·votes_aggregate·group_confirm·notify_f1~f5·calendar_push·click_log·attribution_match·ocr_everytime, tests)
```

(`kakao_login` 제거, `branch_attribution` → `attribution_match` 통일 — D28 자체 구축이므로 이름 일관성)

- [ ] **Step 4.3: rules/react-native.md AuthProvider 행 update**

`.claude/rules/react-native.md` line 66-68:

```markdown
- **API key는 항상 서버 (Edge Function) 통과** — 클라이언트 expose 금지 (Kakao, Naver, Gemini, HMAC secret). 예외: Naver Map SDK key
- **`PlaceSearchProvider` interface** — Kakao Local + Naver Search plug-in (S16 fallback 대비)
- **`AuthProvider` interface** — Kakao synthetic + Apple ID plug-in
```

교체:

```markdown
- **API key는 항상 서버 (Edge Function) 통과** — 클라이언트 expose 금지 (Kakao REST/Admin·Naver Local·Gemini·HMAC secret). 예외: Naver Map SDK key, Kakao Native app key (SDK 초기화)
- **`PlaceSearchProvider` interface** — Kakao Local + Naver Search plug-in (S16 fallback 대비)
- **`AuthProvider` interface** — `KakaoOIDCProvider` ([D29](../../docs/DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede)) + `AppleAuthProvider` plug-in (S16 Phase 3 대비)
```

- [ ] **Step 4.4: agents/reviewer.md secret check 항목**

`.claude/agents/reviewer.md` line 42:

```markdown
- HMAC·Kakao OAuth·Gemini key = Edge Function only
```

교체:

```markdown
- Kakao REST/Admin·Gemini·HMAC secret = Edge Function only. 예외: Naver Map SDK key, Kakao Native app key
```

- [ ] **Step 4.5: skills/start-task/SKILL.md S01 진입 가이드**

`.claude/skills/start-task/SKILL.md` line 98:

```markdown
| S01 (Kakao OAuth) | ARCHITECTURE.md §3.1, D1, D21, rules/supabase.md |
```

교체:

```markdown
| S01 (Kakao OIDC OAuth) | ARCHITECTURE.md §3.1, D1, D29, rules/supabase.md |
```

- [ ] **Step 4.6: 변경 verify**

Run:

```bash
grep -rn "synthetic\|HMAC·Kakao OAuth\|Kakao OAuth secret (HMAC)\|Kakao synthetic" "c:/dev/된다 앱/.claude/"
```

Expected: empty output.

- [ ] **Step 4.7: Commit**

```bash
git add .claude/rules/supabase.md .claude/rules/react-native.md .claude/agents/reviewer.md .claude/skills/start-task/SKILL.md
git commit -m "$(cat <<'EOF'
chore(harness): D29 — drop HMAC OAuth, OIDC AuthProvider

rules/supabase.md API key 표 정리 (Kakao key 종류 명시, HMAC secret 용도
D28 fingerprint로 재정의), rules/react-native.md AuthProvider interface
docstring D29 참조, agents/reviewer.md secret check 정리,
skills/start-task SKILL.md S01 진입 가이드 D21→D29.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: .env.example + 0002_rls.sql 헤더 comment cleanup

**Files:**
- Modify: `.env.example:28-29` (HMAC_SECRET 용도 코멘트)
- Modify: `supabase/migrations/0002_rls.sql:4` (헤더 결정 의존 코멘트)

---

- [ ] **Step 5.1: .env.example HMAC_SECRET 용도 재정의**

`.env.example` line 28-29:

```bash
# === HMAC secret — Edge Function only (D21 synthetic email 서명) ===
HMAC_SECRET=generate-32byte-random-here
```

교체:

```bash
# === HMAC secret — Edge Function only (D28 자체 deferred deep link fingerprint salt) ===
# 사용처: web-guest /g/<token> route 진입 시 ip_hash·ua_hash 생성
# (D21 synthetic email 용도는 D29로 폐기. secret 값은 D28에서 계속 사용)
HMAC_SECRET=generate-32byte-random-here
```

- [ ] **Step 5.2: 0002_rls.sql 헤더 코멘트**

`supabase/migrations/0002_rls.sql` line 1-10:

```sql
-- ============================================================================
-- 된다 (DenDa) — RLS Policies (Phase 1+2 skeleton)
-- 출처: docs/ARCHITECTURE.md (§3-§4), docs/DECISIONS.md
-- 결정 의존: D16 (is_blocked helper 모든 SELECT 통과), D21 (auth.uid() = users.id)
--
-- 패턴:
--   SELECT: 본인 + (is_blocked 통과)
--   INSERT: 본인
--   UPDATE/DELETE: 본인 또는 호스트
-- ============================================================================
```

교체:

```sql
-- ============================================================================
-- 된다 (DenDa) — RLS Policies (Phase 1+2 skeleton)
-- 출처: docs/ARCHITECTURE.md (§3-§4), docs/DECISIONS.md
-- 결정 의존: D16 (is_blocked helper 모든 SELECT 통과)
-- 구조: auth.uid() = public.users.id (Supabase Auth 1:1 매핑 — D29 OIDC trigger)
--
-- 패턴:
--   SELECT: 본인 + (is_blocked 통과)
--   INSERT: 본인
--   UPDATE/DELETE: 본인 또는 호스트
-- ============================================================================
```

(D21 reference 제거, auth.uid() = users.id는 구조적 사실이므로 D29 trigger 출처로 설명)

- [ ] **Step 5.3: 변경 verify**

```bash
grep -n "D21\|synthetic" "c:/dev/된다 앱/.env.example" "c:/dev/된다 앱/supabase/migrations/0002_rls.sql"
```

Expected: empty output.

- [ ] **Step 5.4: Commit**

```bash
git add .env.example supabase/migrations/0002_rls.sql
git commit -m "$(cat <<'EOF'
chore: env + 0002_rls comment — D21→D28/D29 reference cleanup

HMAC_SECRET 용도를 D21 synthetic email → D28 자체 deferred deep link
fingerprint salt로 재정의 (secret 값 자체는 그대로 재사용).
0002_rls.sql 헤더에서 D21 의존 표기 제거.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Migration 0003 — schema amend + trigger 재작성

**Files:**
- Create: `supabase/migrations/0003_kakao_oidc_amend.sql`

---

- [ ] **Step 6.1: Migration 0003 SQL 작성**

Create file `supabase/migrations/0003_kakao_oidc_amend.sql` with the following content:

```sql
-- ============================================================================
-- 된다 (DenDa) — Migration 0003: Kakao OIDC amend (D29 supersede D21)
-- 출처: docs/superpowers/specs/2026-05-22-kakao-oidc-design.md
-- 결정 의존: D29 (Kakao OIDC + Supabase signInWithIdToken)
--
-- 변경 사항:
--   1. public.users.synthetic_email 컬럼 DROP (D21 잔재)
--   2. public.users.email 컬럼 ADD (nullable, Phase 3 비즈앱 후 채움)
--   3. handle_new_auth_user trigger 함수 재작성
--      - kakao_id = raw_user_meta_data->>'sub' (OIDC standard claim)
--      - nickname = raw_user_meta_data->>'nickname'/'name' fallback chain
--      - email = NEW.email (베타는 null, Phase 3에서 자동 채워짐)
--      - profile_image_url = raw_user_meta_data->>'picture'
--
-- 안전성:
--   S00 (0001_initial) 적용 후 user 데이터 없음 (2026-05-22 same day) →
--   synthetic_email DROP은 데이터 손실 없음. Production user 0명 가정.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. users.synthetic_email DROP + email ADD
-- ============================================================================

-- UNIQUE constraint와 NOT NULL이 함께 정의된 컬럼이므로 그대로 DROP
ALTER TABLE public.users DROP COLUMN IF EXISTS synthetic_email;

-- email 컬럼 추가 (nullable, UNIQUE — Postgres에서 NULL은 UNIQUE 중복 검사 제외)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON public.users(email) WHERE email IS NOT NULL;

COMMENT ON COLUMN public.users.email IS
  'D29: 베타는 null (scope=openid+profile_nickname). Phase 3 비즈앱 등록 후 account_email scope 추가 시 카카오에서 받은 이메일 채움.';

-- ============================================================================
-- 2. handle_new_auth_user trigger 함수 재작성
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, kakao_id, email, nickname, profile_image_url)
  VALUES (
    NEW.id,
    -- OIDC standard claim. Supabase signInWithIdToken은 id_token.sub을 raw_user_meta_data.sub에 저장.
    -- Sprint 0 스모크 테스트에서 실제 claim 키 확인 의무 (provider_id, sub, kakao_id 중 무엇인지).
    NEW.raw_user_meta_data->>'sub',
    -- email = NEW.email (베타에는 null; Phase 3 account_email scope 추가 후 자동 채워짐)
    NEW.email,
    -- nickname fallback chain: OIDC profile_nickname claim → name → 익명
    COALESCE(
      NEW.raw_user_meta_data->>'nickname',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'preferred_username',
      '익명'
    ),
    -- OIDC standard picture claim
    NEW.raw_user_meta_data->>'picture'
  );
  -- 알림 설정 기본값 (변경 없음 — 0001 initial에서 그대로 가져옴)
  INSERT INTO public.notification_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger 자체는 0001에서 정의됨 — 함수만 재작성하므로 CREATE TRIGGER 재실행 불필요

COMMENT ON FUNCTION public.handle_new_auth_user IS
  'D29: Supabase signInWithIdToken({provider: kakao}) → auth.users INSERT 시 public.users 자동 동기화. raw_user_meta_data claim 키는 Sprint 0 스모크 테스트로 검증.';

-- ============================================================================
-- 3. kakao_id NOT NULL 보장 (0001에서 이미 NOT NULL 이지만 확인 차원)
--    OIDC sub claim이 항상 존재해야 함 — null 들어오면 trigger 실패하도록.
-- ============================================================================

-- 0001에서 ALREADY NOT NULL, idempotent로 ensure
ALTER TABLE public.users ALTER COLUMN kakao_id SET NOT NULL;

COMMIT;

-- ============================================================================
-- Sprint 0 스모크 테스트 (psql 또는 Supabase SQL editor에서 수동 실행):
--
-- -- 1. column 검증
-- SELECT column_name, is_nullable, data_type
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='users'
--   AND column_name IN ('synthetic_email','email','kakao_id');
-- Expected: synthetic_email 행 0개, email 행 (YES, text), kakao_id 행 (NO, text)
--
-- -- 2. trigger 함수 시그니처 확인
-- \df public.handle_new_auth_user
--
-- -- 3. 실제 Kakao OIDC 로그인 1회 후 raw_user_meta_data 구조 확인
-- SELECT id, email, raw_user_meta_data
-- FROM auth.users
-- ORDER BY created_at DESC LIMIT 1;
-- Expected: raw_user_meta_data에 'sub' (또는 'provider_id'), 'nickname',
--           'picture' 등 카카오 OIDC claim 존재. claim 키가 'sub'이 아니면
--           handle_new_auth_user 함수의 ->>'sub' 부분을 실제 키로 수정 후 재배포.
-- ============================================================================
```

- [ ] **Step 6.2: Migration 작성 후 syntax sanity check**

Run a static SQL parse check. Project에 Supabase CLI 있으면:

```bash
supabase db lint
```

또는 psql 없이 minimal check:

```bash
grep -E "^(BEGIN|COMMIT|ALTER|CREATE|DROP|INSERT)" "c:/dev/된다 앱/supabase/migrations/0003_kakao_oidc_amend.sql" | wc -l
```

Expected: > 5 (BEGIN, COMMIT, ALTER 등 정상 키워드 확인).

- [ ] **Step 6.3: 0001_initial.sql 헤더 코멘트 update (cross-reference)**

`supabase/migrations/0001_initial.sql` line 1-7, 헤더 코멘트:

```sql
-- ============================================================================
-- 된다 (DenDa) — Phase 1+2 Initial Schema
-- 출처: docs/ARCHITECTURE.md §2, docs/DECISIONS.md
-- 결정 의존: D3 (partnerships only), D13 (TIMESTAMPTZ UTC), D14 (15분 슬롯),
--           D15 (schedules.source enum), D16 (is_blocked helper), D17 (f4_sent_at),
--           D18 (좌표 WGS84), D21 (synthetic email)
-- ============================================================================
```

교체:

```sql
-- ============================================================================
-- 된다 (DenDa) — Phase 1+2 Initial Schema
-- 출처: docs/ARCHITECTURE.md §2, docs/DECISIONS.md
-- 결정 의존: D3 (partnerships only), D13 (TIMESTAMPTZ UTC), D14 (15분 슬롯),
--           D15 (schedules.source enum), D16 (is_blocked helper), D17 (f4_sent_at),
--           D18 (좌표 WGS84)
-- 주의: D21 (synthetic email)은 supersede됨 — 0003_kakao_oidc_amend.sql 참조 (D29)
-- ============================================================================
```

같은 파일 line 49-50 `## 3. users` 절 헤더:

```sql
-- ============================================================================
-- 3. users — 카카오 synthetic email 사용자 프로필 (auth.users 확장)
-- 결정: D21 synthetic email + HMAC. Supabase auth.users.id를 PK로 1:1 연결.
-- ============================================================================
```

교체:

```sql
-- ============================================================================
-- 3. users — 카카오 OIDC 사용자 프로필 (auth.users 확장)
-- 결정: [D29] OIDC + signInWithIdToken. auth.users.id를 PK로 1:1 연결.
--       synthetic_email 컬럼은 0003에서 DROP, email로 대체.
-- ============================================================================
```

(0001 본문의 컬럼 정의 자체는 변경 안 함 — historical migration이라 그대로 보존. 0003이 amend한다.)

- [ ] **Step 6.4: 변경 verify**

```bash
ls "c:/dev/된다 앱/supabase/migrations/"
# Expected: 0001_initial.sql, 0002_rls.sql, 0003_kakao_oidc_amend.sql
```

```bash
grep -n "D21\|synthetic" "c:/dev/된다 앱/supabase/migrations/0001_initial.sql"
# Expected: 헤더 코멘트의 "D21 (synthetic email)은 supersede됨" 한 줄, 
# 그리고 본문 line 49-50의 새 코멘트 "synthetic_email 컬럼은 0003에서 DROP" 한 줄.
# 본문 line 56의 'synthetic_email TEXT NOT NULL UNIQUE' 등은 historical로 보존.
```

(0001 본문은 historical migration이므로 컬럼 정의·trigger 본문에 `synthetic_email`이 남아 있는 게 정상. 0003이 amend한다.)

- [ ] **Step 6.5: Commit**

```bash
git add supabase/migrations/0003_kakao_oidc_amend.sql supabase/migrations/0001_initial.sql
git commit -m "$(cat <<'EOF'
feat(migration): 0003 — Kakao OIDC schema amend (D29)

users.synthetic_email DROP, email (nullable, UNIQUE-on-not-null) ADD,
handle_new_auth_user trigger 함수 재작성 (raw_user_meta_data 'sub' claim
사용, nickname fallback chain, picture/email standard OIDC claims).

0001 헤더 코멘트도 D29 supersede 참조 추가 (본문 historical 보존).

스모크 테스트 절차는 migration 파일 하단 코멘트 참조 — Sprint 0에서
실제 Kakao OIDC 로그인 1회 후 raw_user_meta_data claim 키 검증 의무.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 미사용 코드 삭제 — kakao_login Edge Function + hmac.ts::syntheticEmail

**Files:**
- Delete: `supabase/functions/kakao_login/` (디렉토리 전체)
- Modify: `supabase/functions/_lib/hmac.ts` (`syntheticEmail()` 함수만 삭제, `hmacSha256`/`verifyHmacSha256`는 D28에서 재사용하므로 보존 + 헤더 코멘트 update)

---

- [ ] **Step 7.1: kakao_login Edge Function 디렉토리 존재 확인**

Run:

```bash
ls "c:/dev/된다 앱/supabase/functions/kakao_login/"
```

Expected: index.ts (또는 다른 파일) 존재. 없으면 이미 삭제됨 → Step 7.2 skip.

- [ ] **Step 7.2: kakao_login 디렉토리 삭제**

```bash
git rm -rf "c:/dev/된다 앱/supabase/functions/kakao_login/"
```

(`git rm`이 untracked인 경우 `rm -rf "c:/dev/된다 앱/supabase/functions/kakao_login/"` + 이후 `git add` 단계 없음)

- [ ] **Step 7.3: hmac.ts 재작성 (syntheticEmail 제거 + 헤더 update)**

`supabase/functions/_lib/hmac.ts` 전체 내용 확인:

```typescript
// HMAC 서명 — D21 Kakao synthetic email 검증용
// HMAC_SECRET은 Supabase secret. 클라이언트 expose 금지.

export async function hmacSha256(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyHmacSha256(
  message: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expected = await hmacSha256(message, secret);
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

export function syntheticEmail(kakaoId: string): string {
  return `kakao_${kakaoId}@denda.synthetic`;
}
```

다음으로 전체 교체:

```typescript
// HMAC SHA-256 utility — D28 자체 deferred deep link fingerprint salt 용도.
// HMAC_SECRET은 Supabase secret. 클라이언트 expose 금지.
//
// 이력: D21 (Kakao synthetic email 검증) 용도였으나 D29 (Kakao OIDC) 채택으로
//       D21 폐기. syntheticEmail() 함수는 제거됨. hmacSha256/verifyHmacSha256은
//       D28 attribution_match Edge Function의 ip_hash·ua_hash 생성에 재사용.

export async function hmacSha256(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyHmacSha256(
  message: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expected = await hmacSha256(message, secret);
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}
```

(`syntheticEmail()` 함수 제거. 나머지 utility 보존. 헤더 코멘트 D28 용도로 update.)

- [ ] **Step 7.4: hmac.ts에서 syntheticEmail import 잔재 확인**

Run grep across the project to ensure no code imports `syntheticEmail`:

```bash
grep -rn "syntheticEmail\|synthetic_email" "c:/dev/된다 앱/supabase/" "c:/dev/된다 앱/src/" 2>/dev/null
```

Expected: empty output (S01·KakaoOIDCProvider 구현 전이므로 src/lib/auth/ 아직 없음).

- [ ] **Step 7.5: Commit**

```bash
git add supabase/functions/_lib/hmac.ts
# kakao_login 디렉토리는 git rm으로 이미 stage됨
git commit -m "$(cat <<'EOF'
refactor: drop kakao_login Edge Function + syntheticEmail() (D29)

D21 잔재 코드 정리:
- supabase/functions/kakao_login/ 전체 삭제 (Supabase Auth가 id_token 검증·
  user 생성 모두 담당하므로 자체 검증 불필요)
- _lib/hmac.ts::syntheticEmail() 함수 삭제
- hmacSha256/verifyHmacSha256은 D28 fingerprint 용도로 재사용을 위해 보존
  (헤더 코멘트 update)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 최종 verification — orphan reference grep

**Files:** (변경 없음, 검증 only)

---

- [ ] **Step 8.1: synthetic_email orphan check**

Run:

```bash
grep -rn "synthetic_email\|synthetic email" "c:/dev/된다 앱/" \
  --include="*.md" --include="*.sql" --include="*.ts" --include="*.tsx" \
  --include="*.json" --include="*.yaml" --include="*.yml" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=archive 2>/dev/null
```

Expected matches (allowed — historical/spec contexts):
- `docs/superpowers/specs/2026-05-22-kakao-oidc-design.md` (이 spec 자체)
- `docs/superpowers/plans/2026-05-22-kakao-oidc-implementation.md` (이 plan 자체)
- `docs/DECISIONS.md` D21 절 본문 (Superseded marker와 함께 historical 보존)
- `docs/SESSION_LOG.md` (이력 entry — past tense)
- `supabase/migrations/0001_initial.sql` (historical migration, 본문 보존)

Expected NOT to appear:
- 활성 코드 (`src/`, `supabase/functions/`)
- 활성 docs (PROJECT_CONTEXT, TASK_BACKLOG, PRD, ARCHITECTURE, TEST_PLAN, PROGRESS, OPEN_QUESTIONS — 본문)
- harness layer (`.claude/`)

- [ ] **Step 8.2: kakao_login orphan check**

```bash
grep -rn "kakao_login" "c:/dev/된다 앱/" \
  --include="*.md" --include="*.sql" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=archive 2>/dev/null
```

Expected matches (allowed):
- `docs/superpowers/specs/...kakao-oidc-design.md`
- `docs/superpowers/plans/...kakao-oidc-implementation.md`
- `docs/SESSION_LOG.md` (이력)
- `docs/DECISIONS.md` D21 절 (historical)

Expected NOT to appear:
- 활성 docs 본문
- harness layer
- `supabase/functions/` (디렉토리 자체가 삭제됐어야 함)

- [ ] **Step 8.3: D21 reference 잔재 확인**

```bash
grep -rn "D21" "c:/dev/된다 앱/" \
  --include="*.md" --include="*.sql" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=archive 2>/dev/null
```

Expected matches (allowed):
- `docs/superpowers/specs/...kakao-oidc-design.md` (spec)
- `docs/superpowers/plans/...kakao-oidc-implementation.md` (이 plan)
- `docs/DECISIONS.md` (D21 절 자체 + D29 절의 "D21 supersede" 참조 + D1 본문 link)
- `docs/OPEN_QUESTIONS.md` Q-A1 (해결 본문에 "D21 폐기")
- `docs/PRD.md:843` (D29 본문 옆 D21 supersede 참조)
- `docs/SESSION_LOG.md`, archive — historical
- `supabase/migrations/0001_initial.sql` (헤더 코멘트의 supersede 안내 1줄)

Expected NOT to appear:
- 활성 정책 문장 (D21을 현재 결정으로 인용하는 곳 — 모두 D29로 교체됐어야 함)
- harness layer (`.claude/`)

- [ ] **Step 8.4: D29 forward reference 확인 (positive check)**

```bash
grep -rn "D29" "c:/dev/된다 앱/" \
  --include="*.md" --include="*.sql" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=archive 2>/dev/null | wc -l
```

Expected: ≥ 15 (DECISIONS, OPEN_QUESTIONS, PROJECT_CONTEXT, TASK_BACKLOG, PROGRESS, ARCHITECTURE, PRD, TEST_PLAN, rules/supabase, rules/react-native, agents/reviewer, skills/start-task, .env.example, 0003 migration, spec, plan, 0001 헤더 — 합계).

만약 15 미만이면 누락된 update 있음 → 어느 파일이 빠졌는지 회귀 확인 후 추가 commit.

- [ ] **Step 8.5: Git log 마지막 7개 commit 검증**

```bash
git log --oneline -n 8
```

Expected 순서 (가장 최근 commit이 위):

```
<hash> refactor: drop kakao_login Edge Function + syntheticEmail() (D29)
<hash> feat(migration): 0003 — Kakao OIDC schema amend (D29)
<hash> chore: env + 0002_rls comment — D21→D28/D29 reference cleanup
<hash> chore(harness): D29 — drop HMAC OAuth, OIDC AuthProvider
<hash> docs: TASK_BACKLOG/PRD/TEST_PLAN — D29 Kakao OIDC references
<hash> docs(architecture): §3.1 Kakao OIDC flow (D29 supersede D21)
<hash> docs: D29 — Kakao OIDC supersede D21 (decision SSoT + index)
969bcd3 spec: D29 — Kakao OIDC OAuth design (D21 supersede)
```

7개 신규 commit + 1개 spec commit = 8개.

- [ ] **Step 8.6: 최종 git status 검증**

```bash
git status --short
```

Expected:
- 작업 전 있던 stale entries (`D HARNESS_REFACTOR_SPEC.md`, `D HARNESS_SSOT_FOLLOWUP_SPEC.md`, `?? harness_setting/`) 외에는 modification 없음
- 우리가 변경한 모든 파일은 committed 상태

- [ ] **Step 8.7: 정책 변경 절차 사후 검증 (CLAUDE.md 요구사항)**

CLAUDE.md "정책 변경 절차"는 다음을 요구:
1. ✅ 사용자 승인 (2026-05-22 받음)
2. ✅ 변경 사유 git commit 메시지 명시 (각 commit body에 spec link + D29 supersede 기재)
3. ✅ 영향받는 rules/skills/agents 함께 변경 (Task 4에서 4개 파일 동시 update)

또한 spec §6 영향 문서 표(7건 + migration 1건)와 plan task 매핑:

| Spec 명시 | Plan task |
|---|---|
| DECISIONS.md (D21 supersede + D29 신규 + D1 본문) | Task 1 |
| OPEN_QUESTIONS.md Q-A1 close | Task 1 |
| PROJECT_CONTEXT.md §3·§8 | Task 1 |
| TASK_BACKLOG.md S01 rewrite + Sprint 0 | Task 3 |
| PROGRESS.md BLOCKED count | Task 1 |
| ARCHITECTURE.md §1·§2·§3.1 | Task 2 |
| .claude/rules/supabase.md API key 표 | Task 4 |
| Migration 0003 | Task 6 |

Spec 추가 (plan에 새로 발견된 영향):
- PRD.md §13.1 — Task 3 (spec §6에 빠졌지만 grep으로 발견)
- TEST_PLAN.md §3.2 — Task 3 (spec §6에 빠졌지만 grep으로 발견)
- .claude/rules/react-native.md AuthProvider line — Task 4 (spec §6에 빠졌지만 grep으로 발견)
- .claude/agents/reviewer.md secret check — Task 4 (spec §6에 빠졌지만 grep으로 발견)
- .claude/skills/start-task/SKILL.md S01 — Task 4 (spec §6에 빠졌지만 grep으로 발견)
- .env.example HMAC_SECRET 용도 — Task 5 (spec에 암묵, plan에 명시)
- 0002_rls.sql 헤더 코멘트 — Task 5 (spec에 암묵, plan에 명시)
- 0001_initial.sql 헤더 코멘트 cross-reference — Task 6 (spec에 암묵, plan에 명시)

이 추가들은 spec 작성 시점에 grep을 안 했기 때문에 누락된 것. Plan 실행 시 모두 cover됨.

**verification 완료 시점**:
- `git log -n 8 --oneline`이 위 예상 결과와 일치
- 모든 grep check가 expected와 일치
- `git status`에 우리 변경 외 dirty file 없음

**다음 단계**:
- Sprint 0 인프라 체크리스트 수행: Kakao 디벨로퍼스 + Supabase Auth dashboard 설정 (사용자 수동)
- 실제 Kakao OIDC 로그인 1회 스모크 테스트 → migration 0003의 trigger가 raw_user_meta_data 'sub' claim을 정확히 읽는지 검증. 만약 claim 키가 다르면 0004 migration으로 trigger 함수 fix-up
- `/start-task S01` → KakaoOIDCProvider.ts + AuthProvider interface 구현 흐름

---

## 검증 chk

### Spec coverage 매트릭스

| Spec section | Plan task |
|---|---|
| §2.1 D29 결정 본문 | Task 1.2 |
| §2.2 검증된 사실 | Spec에 기록됨 (plan 작성 전 web fetch 완료, 969bcd3 commit) |
| §2.3 Phase 3 전환 path | Task 1.2 (D29 본문 안에 명시), Task 2.3 (ARCHITECTURE §3.1) |
| §3 클라이언트 flow | Task 2.3 (ARCHITECTURE §3.1 다이어그램) |
| §4 Server-side flow | Task 2.3 + Task 6 + Task 7 |
| §5 S01 acceptance rewrite | Task 3.3 |
| §6 영향 문서 표 | Tasks 1-7 합계 |
| §7 Sprint 0 체크리스트 추가 | Task 3.4 |
| §8 Open Risks | (이 plan은 실행 plan. risk는 Sprint 0 + S01 task가 처리) |
| §9 Acceptance for spec | (writing-plans 호출 = §9 acceptance 통과) |

### Type/identifier consistency

- `KakaoOIDCProvider` (Task 3.3 S01 Files) ↔ ARCHITECTURE.md §3.1 (Task 2.3)에서도 동일 이름 사용 ✅
- `handle_new_auth_user` 함수 이름 (Task 6.1 migration) ↔ Task 3.3 S01 acceptance 본문 ↔ ARCHITECTURE.md §3.1 ✅
- `on_auth_user_created` trigger 이름 (Task 6.1) ↔ Task 3.3 ↔ ARCHITECTURE.md ✅
- Claim 키 `sub` (Task 6.1 trigger) — Sprint 0 스모크 테스트에서 확정 후 fix-up 가능하다는 명시 (Task 6.1 코멘트) ✅
- Scope `['openid', 'profile_nickname']` (Task 3.3 S01) ↔ ARCHITECTURE.md §3.1 (Task 2.3) ↔ D29 결정 본문 (Task 1.2) ✅

### Placeholder check

- 모든 step에 actual content (Edit 대상 before/after, SQL DDL, bash command) 존재
- "TBD" / "implement later" / "add error handling" 같은 placeholder 없음
- 각 step은 2-5분 단위 작업
- Commit step은 항상 마지막에 위치

---

## 참조

- Spec: [docs/superpowers/specs/2026-05-22-kakao-oidc-design.md](../specs/2026-05-22-kakao-oidc-design.md)
- 결정: [DECISIONS.md D21](../../DECISIONS.md) (supersede), D29 (신규)
- 외부:
  - [Supabase Auth — Kakao social login](https://supabase.com/docs/guides/auth/social-login/auth-kakao)
  - [Kakao Developers — Kakao Login](https://developers.kakao.com/docs/latest/en/kakaologin/common)
  - [@mj-studio/react-native-kakao](https://rnkakao.mjstudio.net/)
