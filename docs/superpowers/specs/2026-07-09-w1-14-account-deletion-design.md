# W1-14 회원 탈퇴 — 설계 (2026-07-09)

> 상태: ✅ **승인 (2026-07-09, 사용자 결정 4건)**. UI 폴리시 Wave 1 P0 (Apple 5.1.1(v)·Google Play 데이터 삭제 스토어 심사 요건).
> 상위 플랜: [2026-07-08-ui-polish-design.md](2026-07-08-ui-polish-design.md) §4.4 W1-14 · 인수인계 [2026-07-09-ui-polish-wave1-handoff.md](2026-07-09-ui-polish-wave1-handoff.md).
> 근거 조사: `account-deletion-surface-map` 워크플로(5-리더 fan-out) + **직접 스키마 재검증**(0001·0012·0013·0017 — 워크플로 리더 2개 실패·1개 오류로 FK 그래프를 손으로 재확인).

---

## 1. 사용자 결정 (2026-07-09 승인)

| # | 결정 | 근거 |
|---|---|---|
| **호스트 모임** | **함께 삭제 + 사전 고지** (cascade) | 베타 짧은 수명 모임 · 스토어는 무조건 삭제 선호(차단 지양) · 호스트 떠난 모임은 확정 불가로 사실상 사망 |
| **삭제 시점** | **즉시 하드 딜리트** | 스토어 요건 충족 · 최소 배관 · UNIQUE kakao_id/email 즉시 해제(재가입 쿨다운 없음 — 베타엔 오히려 자연스러움) |
| **신고 기록** | **현행 cascade 유지** | 신고는 카톡 실시간 수동 처리 · 탈퇴자는 이미 플랫폼에서 사라져 사후 조치 가치 낮음 · 마이그레이션 회피 |
| **Google 토큰** | **best-effort revoke 포함** | 제3자(구글 캘린더) 접근 권한 자체를 끊는 프라이버시-완결 · non-blocking(실패해도 삭제 진행) |

→ **DB 마이그레이션 0개.** cascade 체인이 전부 처리하고 RESTRICT/NO ACTION FK가 없어 `admin.deleteUser`가 깨끗이 통과.

---

## 2. 검증된 삭제 표면 (직접 재검증)

- **루트**: `public.users.id → auth.users(id) ON DELETE CASCADE` (0001:57). `handle_new_auth_user`는 **AFTER INSERT only** (0001:446) → **auth.users 레이어에서 삭제해야** 함. `public.users`만 지우면 로그인 가능한 고아 auth 행이 남고 재로그인해도 프로필이 다시 안 생김(반쪽 삭제).
- **전 user-FK = CASCADE**. 예외 2개만 `SET NULL`(행 보존, PII 링크만 제거):
  - `group_guests.converted_user_id` (0001:248) — 게스트 닉네임 텍스트만 남고 user 링크 null.
  - `branch_attributions.converted_user_id` (0001:415) — **RLS 정책 없음 = service_role only → 클라 비가시**. 잔여 PII 링크 없음.
- **직접 auth.users 참조 2개**: `user_oauth_tokens` (0012:27), `calendar_push_apple_pending` (0013:27) — 둘 다 CASCADE.
- `click_events.user_id` (0017:33) = **CASCADE 하드삭제** (워크플로 synthesis의 "click_log SET NULL"은 오류 — 직접 확인).
- **스토리지 없음**: `src`에 `storage.from`/`.upload` 0건. `profile_image_url`은 카카오 CDN URL(0001:438)이라 Supabase 오브젝트 아님 → **스토리지 teardown 불필요**(phantom step 제거).
- **DELETE 정책 없음**(`public.users`) → 클라의 authenticated DELETE는 0행(성공처럼 보임) → **반드시 service_role Edge 경유**.
- SECURITY DEFINER 함수는 전부 postgres/마이그레이션 role 소유 → 사용자 삭제로 깨지지 않음.
- `votes` cascade 삭제 시 `notify_votes_aggregate`(0006) AFTER DELETE가 group당 broadcast 버스트 → async·idempotent, 무해(히트맵은 멤버 이탈 시 갱신이 맞음).

---

## 3. 아키텍처

**데이터 흐름**: 프로필 '관리' → 2단 ConfirmSheet(destructive) → `deleteAccount()` → Edge `delete_account`(service_role) → (best-effort Google revoke) → `auth.admin.deleteUser` → 전 테이블 cascade → 클라 로컬 teardown → 스플래시.

### ① Edge Function `supabase/functions/delete_account/index.ts` (+ `_test.ts`)
`click_log` 패턴 미러:
1. POST + preflight. 그 외 메서드 405.
2. `getAnonClient(authHeader).auth.getUser()`로 **JWT에서 user_id 도출** — 인자로 절대 안 받음(규칙7 · IDOR 차단). Authorization 없음/만료 → 401 한국어.
3. **best-effort Google revoke**: `getServiceRoleClient()`로 `user_oauth_tokens`에서 `(user_id, provider='google_calendar')`의 `refresh_token` SELECT → 있으면 `https://oauth2.googleapis.com/revoke?token=…`에 POST. 실패/부재는 삼킴(로그만) — 삭제를 막지 않음.
4. `getServiceRoleClient().auth.admin.deleteUser(userId)` → cascade. 실패 → 500 한국어.
5. 성공 → `{ ok: true }`.
- `import.meta.main` 가드 + `handler` export + 순수 헬퍼(요청 검증 얇음).
- env: `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (표준).

### ② lib `src/lib/auth/deleteAccount.ts` (+ `.test.ts`)
- `deleteAccount(client): Promise<void>` → `client.functions.invoke('delete_account')`(body 없음 — JWT가 사용자 식별). 실패 시 throw. 호출부에서 `mapError`.

### ③ authStore `src/lib/auth/authStore.ts` (+ 테스트)
- 신규 액션 `resetForAccountDeletion()`: `provider.signOut()`(try/catch — 세션 이미 서버 삭제) + SecureStore 두 플래그(`denda.auth.terms_agreed_at`·`denda.auth.onboarded`) 삭제 + state 리셋(signed_out·플래그 false). 일반 `signOut`은 플래그를 **보존**하므로(기기 온보딩 유지) 탈퇴 전용 액션 분리 — 동의 플래그가 다음 로그인 사용자에게 누출되지 않게.

### ④ 프론트 `app/(tabs)/profile.tsx`
- '관리' 섹션에 **destructive '회원 탈퇴' 행**(error 토큰 · chevron 없음 · `testID=delete-account-button`).
- **2단 ConfirmSheet**(W0-3 재사용, `destructive`): `deleteStep: null|'warn'|'confirm'`.
  - warn: "정말 탈퇴하시겠어요?" + "회원님이 만든 모임과 그 안의 투표·댓글·초대가 모두 사라져요. 되돌릴 수 없어요." · confirm '탈퇴 계속하기'.
  - confirm: "마지막 확인이에요" + "이 작업은 되돌릴 수 없어요." · confirm '탈퇴하기' · `loading` 바인딩.
- 성공: `resetForAccountDeletion()` + `router.replace('/')` + success Toast("탈퇴가 완료됐어요."). 실패: `mapError` → error Toast, 시트 닫고 행에서 재시도.
- **함께 정리**(handoff "W1-14와 함께"): 기존 pending Alert 3개(알림/화면모드/신고차단)를 non-pressable pending 행으로 — 파일 두 번 안 건드리게 같은 커밋에.
- `useToast` 사용 → 화면 테스트 래퍼에 `ToastProvider` 필수(gotcha).

---

## 4. 검증 / 불가침

- **테스트**: Deno `delete_account/_test.ts`(401·401·revoke·admin 실패 500·성공) + Jest(`deleteAccount` lib · `authStore.resetForAccountDeletion` · profile 화면: 행 존재·2단 시트 전이·성공 teardown·실패 토스트). 전체 Jest 1067+ green 유지.
  - ⚠️ Deno 미설치(로컬 PATH) → 에지 테스트는 기존 에지 테스트와 동일 트랙(deno/`supabase functions test`)에서 실행. 로컬 Jest 루프엔 미포함. click_log 검증 패턴을 그대로 미러.
- **불가침**: Phase 3 코드 0(삭제만) · service_role key Edge-only(규칙7) · 한국어 UI · `new Date()` 금지(Edge는 `nowKst` 불필요·즉시 삭제) · design-guard 통과(destructive=error 토큰, hex 0).
- **@reviewer 강화 체크리스트**:
  - service_role은 `admin.deleteUser`(+토큰 SELECT/revoke)에만 — 범용 우회 금지.
  - user_id는 JWT에서만 도출 — 인자 수용 금지(타인 계정 삭제 IDOR 차단).
  - revoke 실패가 삭제를 막지 않음(non-blocking).
  - cascade 범위가 D1 결정(호스트 모임 함께 삭제)과 일치하고 사전 고지가 UI에 존재.

---

## 5. 파일 매니페스트

| 파일 | 신규/수정 |
|---|---|
| `supabase/functions/delete_account/index.ts` | 신규 |
| `supabase/functions/delete_account/_test.ts` | 신규 |
| `src/lib/auth/deleteAccount.ts` | 신규 |
| `src/lib/auth/deleteAccount.test.ts` | 신규 |
| `src/lib/auth/authStore.ts` | 수정(+`resetForAccountDeletion`) |
| `src/lib/auth/authStore.test.ts` | 수정(+테스트) |
| `app/(tabs)/profile.tsx` | 수정(삭제 UI + pending Alert 정리) |
| `tests/screens/profile.test.tsx` | 신규/수정 |
