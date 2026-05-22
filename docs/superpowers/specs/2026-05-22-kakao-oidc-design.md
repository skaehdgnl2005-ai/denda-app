# Kakao OIDC OAuth — 정석 카카오 API 채택 (D21 supersede)

**작성일**: 2026-05-22
**소유자**: Founder
**상태**: Draft — 사용자 review 대기
**가칭 결정 ID**: D29 (DECISIONS.md 등재 시 next available 번호 사용 — 현재 D1~D28 존재 → **D29**로 진행)

---

## 1. 배경

### 1.1 현재 우회 방식 (D21)

- `email = f"kakao_{id}@denda.synthetic"` 합성 이메일
- `HMAC(secret, kakao_id)`를 패스워드처럼 사용
- Edge Function `kakao_login`이 카카오 access_token을 직접 검증하고 `supabase.auth.signUp` 호출
- **이유**: 카카오 비즈앱 신청 회피 (이메일 권한 요청 X)

### 1.2 우회의 cost

- **Q-A1 BLOCKER**: 카카오 디벨로퍼스에 정책 위반 여부 1:1 문의 — D1 W1 deadline 2026-05-28
- **S01 BLOCKED**: 답변 미수신 시 Apple ID eager fallback (S16) 강제
- **secret 관리 부담**: HMAC secret을 Supabase secret에 저장·rotation
- **표준에서 이탈**: Supabase Auth가 native 제공하는 검증·token rotation·session 관리를 자체 구현
- **사회적 cost**: 카카오 정책 회색지대 — 답변 후 위반 판정 시 launch 직전 전체 auth 재구축

### 1.3 사용자 결정 (2026-05-22)

D21을 폐기하고 **정석 카카오 API**를 채택. 베타 launch 일정 보호를 위해 2단계 전략:

- **Phase 1+2 (베타)**: 비즈앱 없이 OIDC 표준 flow
- **Phase 3 (Gate #2 ≥ 25% 통과 시)**: 비즈앱 등록 + 이메일 권한 추가

---

## 2. 새 결정 — D29 본문

### 2.1 결정

| 항목 | 내용 |
|---|---|
| 결정 | 카카오 OIDC 표준 OAuth + `supabase.auth.signInWithIdToken({ provider: 'kakao', token })`. 베타는 `scope=openid profile_nickname`만 요청 (비-비즈앱 가능). 비즈앱 등록 + `account_email` scope 추가는 Phase 3로 이연. D21 (synthetic email + HMAC) 폐기 |
| 근거 | Supabase가 카카오를 native id_token provider로 공식 지원. 카카오 OIDC 표준 flow는 정책 회색지대 없음. `account_email` consent만 비즈앱 제약이므로 베타에서 이메일 미수신 trade로 비즈앱 신청을 Phase 3에 align (개인사업자 등록·토스 가맹 심사와 같은 timing) |
| 대안 | (a) D21 유지 — Q-A1 답변 대기 위험, 표준 이탈 (b) 베타에서 비즈앱 등록 강제 — 사업자등록 timing 압박 ↑, launch 1-2주 지연 위험 |
| 의존 | Supabase Auth Kakao provider 활성화 (Sprint 0 §10 인프라 체크리스트), 카카오 디벨로퍼스 portal에서 OpenID Connect 활성화 옵션 ON |
| 결정일 | 2026-05-22 |
| 결과 영향 | S01 BLOCKED → TODO, Q-A1 Closed, D1 W1 deadline은 지도 부분(Q-A2)만 남음, `supabase/functions/kakao_login/` 코드 제거, HMAC secret 폐기 |

### 2.2 검증된 사실 (2026-05-22 web 확인)

1. **Supabase**: `auth.signInWithIdToken({ provider: 'kakao', token: id_token })` 공식 문서화 ([Supabase Kakao Auth docs](https://supabase.com/docs/guides/auth/social-login/auth-kakao))
2. **카카오 OIDC**: `openid` scope으로 id_token 발급 가능. `account_email`만 "Biz App" 등록 제약 (인용: *"the 'account_email' consent item is only available for apps registered as 'Biz App'"*)
3. **RN SDK**: `@react-native-seoul/kakao-login` 및 `react-native-kakao` (mj-studio) 둘 다 OIDC 옵션으로 `idToken` 필드 응답에 포함

### 2.3 Phase 3 전환 path

| 단계 | 액션 | 소유자 |
|---|---|---|
| 1 | 카카오 디벨로퍼스에서 비즈앱 신청 (사업자등록증 제출, 1-2주) | Founder |
| 2 | 승인 후 카카오 portal: `account_email` consent 활성화 | Founder |
| 3 | 앱 코드: `KakaoOIDCProvider` scope에 `account_email` 추가 | Backend |
| 4 | 기존 user 재로그인 시 신규 scope 동의 모달 → Supabase가 새 id_token으로 `auth.users.email` 자동 채움 | — (자동) |
| 5 | F6 (예약 확정 푸시) · F7 (정산 알림) · 식당 communication에서 이메일 활용 | Backend |

**호환성**: `auth.users.email`은 처음부터 nullable이므로 schema 변경 없음. Migration 불필요.

---

## 3. 클라이언트 flow (Phase 1+2)

### 3.1 시퀀스

```
사용자
  │ tap "카카오로 시작"
  ▼
Kakao SDK (RN native)
  │ login(scope=['openid', 'profile_nickname'])
  │ → Kakao login UI (앱 or 웹)
  │ ← KakaoLoginResponse { accessToken, idToken, ... }
  ▼
App
  │ supabase.auth.signInWithIdToken({
  │   provider: 'kakao',
  │   token: response.idToken,
  │   nonce: <원본 nonce>  // replay 방지
  │ })
  ▼
Supabase Auth
  │ id_token 검증:
  │ - issuer == 'https://kauth.kakao.com'
  │ - audience == Kakao REST API key
  │ - signature (Kakao JWKS)
  │ - nonce 매칭
  │ - exp 미만료
  │ → auth.users 행 생성/매칭 (provider_id = id_token.sub)
  │ → session JWT 발급
  ▼
App
  │ session 저장 (Supabase client 자동 SecureStore)
  │ public.users 행 동기화 (Auth Hook 또는 client 첫 진입 시 upsert)
  ▼
홈 진입
```

### 3.2 nonce 처리

- 클라이언트에서 cryptographically random nonce 생성 (e.g. `expo-crypto`의 `randomUUID()`)
- Kakao SDK login 요청 시 nonce 포함
- Supabase `signInWithIdToken` 호출 시 원본 nonce 동봉
- Supabase가 id_token.nonce_hash와 원본 nonce를 비교 검증 — replay attack 방지

### 3.3 토큰 갱신

- Supabase가 session JWT를 자동 refresh (refresh_token은 클라이언트 SecureStore)
- 카카오 access_token/refresh_token은 사용 안 함 (id_token만 인증에 사용)
- Phase 3에서 이메일 권한 추가 시점에 카카오 토큰 재발급 필요 (별도 task)

### 3.4 RN 패키지 선택

**권장**: `@mj-studio/react-native-kakao` ([rnkakao.mjstudio.net](https://rnkakao.mjstudio.net/))
- 이유: 우리가 이미 `@mj-studio/react-native-naver-map` 사용 중 — 같은 생태계, 한국어 docs, 활발한 유지보수
- OIDC `idToken` 응답 지원 확인됨

**대안**: `@react-native-seoul/kakao-login`
- 더 오래된 생태계, 검색 결과 우세, 같은 OIDC 지원
- mj-studio 패키지에 문제 발견 시 fallback

→ Sprint 0에서 둘 다 smoke test 후 결정. 인터페이스(`AuthProvider`)는 동일하므로 패키지 교체 cost 낮음.

---

## 4. Server-side flow

### 4.1 삭제되는 코드

- `supabase/functions/kakao_login/` 전체 — Supabase Auth가 id_token 검증·user 생성 모두 담당
- HMAC 관련 코드·secret
- `users.synthetic_email` 컬럼 (S00이 2026-05-22 완료된 상태이므로 0002 migration으로 amend)

### 4.2 신규 코드

- `src/lib/auth/KakaoOIDCProvider.ts` — `AuthProvider` interface 구현 (S16 fallback 대비 추상화 유지)
- `src/lib/auth/AuthProvider.ts` — interface 정의 (D21 시점에 이미 계획됨, 변경 없음)
- **Supabase Auth Hook (선택)**: `on_auth_user_created` Postgres trigger → `public.users` 행 upsert (kakao_id = `raw_user_meta_data->>'sub'`, nickname = `raw_user_meta_data->>'nickname'`)
  - 또는 client 측 첫 진입 시 `upsert` (more transparent, less infra)
  - **권장**: Postgres trigger — RLS·차단 helper 일관성, race condition 회피

### 4.3 데이터 모델

`public.users` 테이블 (S00 0001 마이그레이션에서 정의됨):

| 컬럼 | D21 | D29 |
|---|---|---|
| `id` | `auth.users.id` FK | 동일 |
| `synthetic_email` | `kakao_{id}@denda.synthetic` | **제거** |
| `email` | (있어도 합성) | `nullable`, 베타는 null, Phase 3에서 채움 |
| `kakao_id` | varchar | 유지 (sub claim 캐시) |
| `nickname` | varchar | 유지 (profile_nickname) |

**Migration 0002 amend**: S00 직후이므로 데이터 손실 없음. `synthetic_email` 컬럼 DROP + `email` 컬럼 nullable 보장 + 인덱스 정리.

---

## 5. S01 acceptance 재작성

### Before (D21)

- Kakao SDK 통합 + access_token 받기
- Edge Function: `kakao_login` (validate token → synthetic email `kakao_{id}@denda.synthetic` → HMAC → `supabase.auth.signUp`)
- 약관·개인정보 동의 모달
- 3-슬라이드 온보딩
- 재로그인 (기존 user 매칭) + Token refresh
- `AuthProvider` interface 추상화

### After (D29)

- `@mj-studio/react-native-kakao` (또는 `@react-native-seoul/kakao-login`) 통합
- OIDC login flow with `scope=['openid', 'profile_nickname']` + cryptographically random nonce
- `supabase.auth.signInWithIdToken({ provider: 'kakao', token: response.idToken, nonce })` 호출
- 약관·개인정보 동의 모달 (V2_PRD §5.1) — 변경 없음
- 3-슬라이드 온보딩 — 변경 없음
- 재로그인 = Supabase가 자동 매칭 (provider_id = sub). Token refresh = Supabase 자동 (client SecureStore)
- `AuthProvider` interface 추상화 (S16 Apple ID fallback 대비) — 유지
- `public.users` 동기화: Postgres trigger `on_auth_user_created` (0002 migration)
- **삭제**: `supabase/functions/kakao_login/` 디렉토리 + 관련 HMAC secret

### Files (변경)

- 추가: `src/lib/auth/KakaoOIDCProvider.ts`, `supabase/migrations/0002_kakao_oidc_amend.sql`
- 유지: `src/lib/auth/AuthProvider.ts`, `src/screens/onboarding/`
- 삭제: `supabase/functions/kakao_login/`

### Status

- BLOCKED (Q-A1) → **TODO**
- Sprint: 2 (변경 없음)
- Worktree 분기: 가능 (변경 없음)

---

## 6. 영향받는 문서·정책 (CLAUDE.md "정책 변경 절차" 의무)

| 문서 | 변경 |
|---|---|
| `docs/DECISIONS.md` | (1) D21 헤더에 "**Superseded by D29 (2026-05-22)**" 추가, 본문 보존 (이력) (2) D29 신규 절 추가 (§2 본문 그대로) (3) D1 "결정" 셀: "비즈앱 우회 OAuth (synthetic email + HMAC)" → "Kakao OIDC native (Supabase signInWithIdToken)"로 update. "결과 영향" 셀: "S01 (Auth) baseline 가능" → "S01 baseline = OIDC 표준. Q-A1 closed by D29." (4) D22 Tech Stack 본문에 변경 없음 |
| `docs/OPEN_QUESTIONS.md` | Q-A1 "상태: 진행 중" → "**Closed by D29 (2026-05-22)** — 비즈앱 우회 OAuth가 아니라 표준 OIDC 사용으로 정책 답변 의존 해소". Q-A2는 변경 없음 (지도는 별개 트랙) |
| `docs/PROJECT_CONTEXT.md` | §3 "카카오 OAuth (D21 synthetic email + HMAC)" → "카카오 OAuth (D29 OIDC + Supabase signInWithIdToken)" |
| `docs/TASK_BACKLOG.md` | S01 acceptance 위 §5에 따라 rewrite. Status: BLOCKED → TODO. Depends 행에서 "D1 W1 deadline" 제거 (auth 부분 한정) |
| `docs/PROGRESS.md` | BLOCKED 카운트 2 → 1 (S10만 남음) |
| `docs/ARCHITECTURE.md` | §3·§4 auth 서술 — 합성 이메일·HMAC·Edge Function `kakao_login` 단락 제거 → OIDC flow 다이어그램 + Supabase Auth Hook trigger 패턴 |
| `.claude/rules/supabase.md` | API key 표에서 "Kakao OAuth secret (HMAC) — Edge Function only" 행 삭제 (secret 자체가 사라짐) |
| `supabase/migrations/` | 0002 신규 — `synthetic_email` 컬럼 DROP + `email` nullable 보장 + Auth Hook trigger |

**불변**:
- `.claude/rules/design.md` — 카카오 auth와 무관
- `.claude/rules/react-native.md` — RN 패키지 추가는 D22 본문 update 불필요 (mj-studio 생태계 내 추가)
- `docs/DESIGN.md` — onboarding 화면 시각 토큰 변경 없음

---

## 7. Sprint 0 인프라 체크리스트 추가 항목

`TASK_BACKLOG.md` §"Sprint 0 — Pre-build 인프라 체크리스트"에 1개 추가:

- [ ] **카카오 디벨로퍼스 portal: OpenID Connect 활성화 + REST API key 등록 + Supabase Auth Kakao provider 활성화** (Sprint 0 §10)
  - 카카오 portal: 앱 설정 → 카카오 로그인 → OpenID Connect 활성화 ON
  - 동의항목: `프로필 정보(닉네임)` 필수 동의, `OpenID Connect` 활성
  - Supabase dashboard: Authentication → Providers → Kakao → Enable + Client ID(REST API key) + Client Secret(있으면)
  - 스모크 테스트: 1회 로그인 → `auth.users` 행 생성 확인

기존 "Kakao Developers app 등록 (Local API key)" 항목은 유지 (지도용).

---

## 8. Open Risks

| Risk | 완화 |
|---|---|
| 카카오 OIDC 활성화가 실제로 비-비즈앱에서 ON 되는지 portal에서 직접 확인 안 됨 | Sprint 0 인프라 체크리스트 1번 항목에서 스모크 테스트 (실패 시 fallback: D21 임시 부활 또는 비즈앱 신청 timeline 앞당김 결정) |
| Supabase Auth Kakao provider의 nonce 검증이 RN 환경에서 cross-platform 일관적인지 | Sprint 0에서 iOS·Android 둘 다 1회씩 verify. nonce는 클라가 만들고 같은 값을 Supabase에 전달하는 표준 OIDC pattern이라 안정적 예상 |
| `@mj-studio/react-native-kakao` vs `@react-native-seoul/kakao-login` 안정성 차이 | Sprint 0에서 둘 다 30분 smoke test. 결정은 PoC 결과 기준. Interface가 같아 패키지 교체 cost ↓ |
| Phase 3 비즈앱 신청 거부 (사업자등록 결격 사유) | 사업자등록증은 Sprint 0 체크리스트 "개인사업자 등록 (미리 시작)"에서 진행 중. Phase 3 진입 시 이미 보유 가정 |
| Phase 3 전환 시점에 기존 user의 `account_email` 동의 거부 | email = null 유지 가능. F6/F7 푸시는 expo push token 우선, 이메일은 보조 채널 |

---

## 9. Acceptance for THIS spec (사용자 review gate)

이 spec이 승인되면 다음 작업으로 이행:

1. `writing-plans` skill 호출 → 위 §6 변경의 implementation plan 생성
2. Plan 단위로 atomic commit (DECISIONS update → OPEN_QUESTIONS update → PROJECT_CONTEXT update → TASK_BACKLOG update → ARCHITECTURE update → rules update → migration 0002 작성 → S01 코드 변경은 별도 `/start-task S01` 흐름)
3. **본 spec은 코드 작성을 아직 시작하지 않음**

---

## 10. 참조

- [Supabase Auth — Kakao social login](https://supabase.com/docs/guides/auth/social-login/auth-kakao)
- [Kakao Developers — Kakao Login](https://developers.kakao.com/docs/latest/en/kakaologin/common)
- [@mj-studio/react-native-kakao](https://rnkakao.mjstudio.net/)
- [@react-native-seoul/kakao-login](https://www.npmjs.com/package/@react-native-seoul/kakao-login)
- 프로젝트 내부: [DECISIONS.md D21](../../DECISIONS.md), [OPEN_QUESTIONS.md Q-A1](../../OPEN_QUESTIONS.md), [TASK_BACKLOG.md S01](../../TASK_BACKLOG.md)
