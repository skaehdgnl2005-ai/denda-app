# 닉네임 직접 설정 — 설계

- **날짜**: 2026-07-29
- **상태**: 승인됨 (구현 대기)
- **관련**: [D7](../../DECISIONS.md), [D16](../../DECISIONS.md#d16--차단신고-일관성-helper-function--rls), [D25](../../DECISIONS.md#d25--cold-start-target--2초--lazy-loading), [D29](../../DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede)

## 1. 문제

카카오 로그인이 카톡 이름을 그대로 가져와 `users.nickname`에 넣는다. 사용자가 고른 이름이 아니고, 동명이인이 구분되지 않는다.

더 심각한 문제가 하나 더 있다 — **닉네임 소스가 두 갈래로 갈라져 있다.**

| 읽는 곳 | 소스 |
|---|---|
| 프로필 화면([profile.tsx:31](../../../app/(tabs)/profile.tsx#L31)), 카톡 초대 문구([useKakaoInvite.ts:15](../../../src/lib/share/useKakaoInvite.ts#L15)) | `session.user.nickname` = Supabase auth `user_metadata` (카카오 클레임 캐시) |
| 친구 검색·목록, 모임 멤버, 초대, 푸시 F1/F2/F3 | `public.users.nickname` (DB) |

`public.users.nickname`만 바꾸면 프로필 화면은 계속 카톡 이름을 보여준다. 두 소스를 하나로 합치는 것이 이 작업의 절반이다.

## 2. 결정 사항

| # | 결정 | 근거 |
|---|---|---|
| 1 | 닉네임 자체를 유니크로 (대소문자 무시) | 새 개념 0개. 당근마켓·번개장터 방식. 별도 친구코드는 컬럼·생성로직·공유 UI를 새로 요구 |
| 2 | 가입 직후 필수 단계 | 모든 사용자가 본인이 고른 이름을 갖게 됨. 자동 생성 이름이 남지 않음 |
| 3 | `public.users`가 단일 진실 | 읽기·쓰기가 한 곳. auth 스키마를 직접 건드리지 않음 |
| 4 | 2~12자 · 변경 무제한 | 한글·영문·숫자·밑줄. 공백·이모지 불가. 베타 규모에서 사칭 리스크보다 수정 자유가 이득 |

## 3. 데이터 모델 — `0024_nickname.sql`

**컬럼 추가**

```
users.nickname_set_at TIMESTAMPTZ NULL
```

"사용자가 직접 정했는가"를 서버에 기록한다. 기기 로컬 SecureStore 플래그(`hasCompletedOnboarding`)와 달리 재설치·기기 교체에도 따라오고, 이미 가입해 있는 사용자도 자동으로 설정 화면을 한 번 거치게 된다. `NULL` = 아직 카톡 이름 그대로.

**유니크 인덱스 — 대소문자 무시**

```sql
CREATE UNIQUE INDEX users_nickname_unique_idx ON public.users (lower(nickname));
```

`Minsu` / `minsu`를 같은 것으로 본다. 안 그러면 유니크가 사실상 뚫린다.

기존 중복 데이터 백필은 하지 않는다. 중복이 남아 있으면 **인덱스 생성이 실패하며 마이그레이션이 멈춘다** — 이것이 의도된 안전장치다. 배포 전 §8의 초기화 절차로 중복을 제거한다.

**조건부 CHECK**

```sql
CHECK (nickname_set_at IS NULL OR (길이 2~12 AND 문자 규칙))
```

전체에 걸면 카톡 이름(1자거나 13자일 수 있음)이 가입 트리거를 깨뜨린다. 사용자가 직접 정한 값만 검사한다.

**트리거 `handle_new_auth_user` 수정**

유니크가 걸린 상태에서 동명이인이 새로 가입하면 트리거 INSERT가 터지고 **로그인 자체가 실패한다.** 카톡 이름을 넣되 충돌 시 `이름_<id앞4자>`로 폴백하고, `nickname_set_at`은 NULL로 둔다. 게이트가 곧바로 설정 화면으로 보내므로 자동 생성 이름은 몇 초만 존재한다.

**손대지 않는 것**: `group_guests.nickname`(웹 게스트 1회용 이름)은 완전히 다른 개념이다.

## 4. 쓰기 경로

### `set_my_nickname(p_nickname text)` — SECURITY DEFINER RPC

클라이언트 UPDATE가 아니라 RPC인 이유는 `nickname_set_at` 때문이다. RLS는 컬럼 단위 제어가 없어서, 클라이언트가 UPDATE할 수 있으면 `nickname_set_at`을 임의로 채워 설정 단계를 건너뛸 수 있다.

1. `auth.uid()` 확인 → 없으면 `not_authenticated`
2. `trim` → 길이 2~12 → 정규식 `^[가-힣a-zA-Z0-9_]+$` (자모 단독 `ㄱ` `ㅏ` 배제)
3. `UPDATE users SET nickname, nickname_set_at = now() WHERE id = auth.uid()`
4. `unique_violation` 캐치 → `RAISE EXCEPTION 'nickname_taken'`

에러는 **안정적인 코드 문자열**로 던진다(`nickname_taken` / `nickname_too_short` / `nickname_too_long` / `nickname_invalid_chars` / `not_authenticated`). 한국어 카피는 클라이언트가 매핑한다 — Postgres 예외 문자열에 UI 카피를 넣으면 문구 하나 바꾸는 데 마이그레이션이 필요해진다.

### `src/lib/profile/nickname.ts` — 순수 검증

```ts
validateNickname(raw: string): { ok: true; value: string } | { ok: false; reason: NicknameError }
```

DB 없이 테스트되고 입력 중 실시간 피드백에 그대로 쓰인다. 규칙이 서버·클라이언트 두 곳에 존재하게 되는데 이는 의도적이다 — 클라이언트는 즉시 피드백용, 서버는 진짜 게이트. 규칙 상수(`MIN=2`, `MAX=12`, 정규식)를 이 파일 한 곳에 두고 마이그레이션 주석이 이 파일을 지목한다.

### `src/lib/profile/api.ts`

- `setMyNickname(nickname)` → `{ ok: true } | { ok: false; reason: NicknameError }`
  - 예상 가능한 실패(중복·규칙 위반)는 **throw하지 않는다.** `mapError()`가 큐레이션된 일반 카피로 덮어써서 "이미 사용 중인 닉네임이에요"가 사라지기 때문이다
  - 네트워크 등 예상 밖 실패만 throw → 호출부가 `mapError` 사용
- `fetchMyProfile(userId)` → `{ nickname, profileImageUrl, nicknameSetAt } | null`

한국어 카피는 [messages.ts](../../../src/lib/i18n/messages.ts)에 `nickname` 섹션으로 모은다(ko-kr 룰의 i18n-ready 패턴).

## 5. 읽기 경로 — authStore

**`AuthUser.nicknameSetAt` — 3-상태**

| 값 | 의미 | 게이트 |
|---|---|---|
| `string` | 사용자가 직접 정함 | 통과 |
| `null` | 아직 카톡 이름 그대로 | 닉네임 화면으로 |
| `undefined` | 아직 서버에 안 물어봄 | 통과 (판단 보류) |

`undefined`가 핵심이다. 없으면 콜드 스타트마다 "모름"을 "미설정"으로 오인해 닉네임 화면이 번쩍인다.

**`AuthStoreDeps.fetchProfile` 주입** — 기존 `restoreSession`과 같은 DI 패턴. 테스트는 fake, [setup.ts](../../../src/lib/auth/setup.ts)만 실제 supabase를 물린다.

**호출 타이밍을 둘로 나눈다** — D25(콜드 스타트 2초)를 지키는 지점.

- **`signIn`**: `await`. 로그인은 이미 카카오 왕복 중이라 쿼리 하나가 체감되지 않고, 신규 가입자는 깜빡임 없이 닉네임 화면으로 직행
- **`bootstrap`(콜드 스타트)**: `await` 하지 **않는다.** 백그라운드로 던지고 완료 시 `set()` — 게이트가 자동 재평가. 콜드 스타트 예산에 0을 더함

대가: 이미 가입해 있던 사용자가 앱을 켜면 홈이 잠깐 보였다가 닉네임 화면으로 넘어간다. 1인당 한 번이고, §8 초기화 후에는 발생하지 않는다.

`fetchProfile` 실패(오프라인 등)는 무시한다 — 카톡 이름이 남고 `nicknameSetAt`은 `undefined`라 앱을 막지 않는다.

**`setNickname` 액션** — RPC 성공 시 세션의 `nickname`·`nicknameSetAt`을 그 자리에서 갱신. 재조회 왕복 없음.

## 6. 게이트

`splash → login → terms → **닉네임** → 온보딩 → 홈`

약관은 법적 선행이라 앞, 온보딩 3슬라이드는 뒤. "내 이름 정하기" 다음에 앱 소개가 오고 마지막 "시작하기"가 홈으로 이어진다.

- [gate.ts](../../../src/lib/auth/gate.ts) `GateDecision`에 `{ kind: 'nickname' }` 추가, `GateInput`에 `nicknameSetAt` 추가
- [app/index.tsx](../../../app/index.tsx)에 `case 'nickname'` 추가
- [terms.tsx:77](../../../app/(auth)/terms.tsx#L77)의 `router.replace('/(auth)/onboarding')` → `'/(auth)/nickname'`
- [(auth)/_layout.tsx](../../../app/(auth)/_layout.tsx)에 `Stack.Screen name="nickname"` 추가

## 7. UI

| 파일 | 역할 |
|---|---|
| `src/components/profile/NicknameField.tsx` | 입력 + 실시간 검증 + 에러 문구. props `value / onChangeText / error / onSubmit`. 두 화면 공유 |
| `app/(auth)/nickname.tsx` | 가입 필수 단계. 카톡 이름 프리필, CTA "확인" |
| `app/profile/nickname.tsx` | 프로필에서 수정. 현재 닉네임 프리필, CTA "저장" |
| `app/(tabs)/profile.tsx` | 프로필 카드가 DB 닉네임 표시 + 설정 섹션에 `닉네임 변경` 행(현재 닉네임을 `hint`로) |

입력 스타일은 [group/new.tsx:96-113](../../../app/group/new.tsx#L96-L113) 패턴을 그대로 따른다(surface-2 배경, radius-md, space-4/3 패딩, Pretendard). 설정 행은 기존 `SettingRow` 컴포넌트 재사용. 보라 fill은 CTA 1개만(D5).

**카피**

| 상황 | 문구 |
|---|---|
| 가입 화면 타이틀 | 어떤 이름으로 부를까요? |
| 보조 설명 | 친구들이 이 이름으로 회원님을 찾아요 |
| 중복 | 이미 사용 중인 닉네임이에요 |
| 너무 짧음 | 2자 이상 입력해주세요 |
| 너무 김 | 12자까지 쓸 수 있어요 |
| 허용 안 되는 문자 | 한글·영문·숫자·밑줄만 쓸 수 있어요 |
| 저장 성공(수정 화면) | 닉네임을 바꿨어요! |

## 8. 배포 절차 (구현 완료 후 1회)

DELETE 후 재가입으로 기존 중복을 해소한다. 베타 테스트 계정만 있다는 전제이며, **`auth.users` 삭제는 그 사용자의 모임·투표·친구관계·초대를 CASCADE로 함께 지운다.**

1. Supabase 대시보드 → Authentication → Users → 전체 삭제 (또는 SQL Editor `delete from auth.users;`)
2. 확인: `select count(*) from public.users;` → `0`
3. 마이그레이션 `0024` 적용
4. 앱 열기 → 프로필 → 로그아웃 1탭 (기기에 남은 세션 정리)
5. 카카오 재로그인 → 닉네임 설정 흐름 진입

3번과 4번 순서는 바꿔도 되지만 1→3 순서는 고정이다. 마이그레이션 전에 재가입하면 `nickname_set_at` 없는 row가 생긴다.

앱 로그아웃을 미리 할 필요는 없다. supabase-js는 세션을 기기에 저장하고 `getSession()`은 네트워크 없이 디스크에서 읽으므로, 계정 삭제 후에도 만료 전 access token(기본 1시간)은 서명이 유효해 PostgREST를 통과한다. 그 사이 `auth.uid()`는 존재하지 않는 UUID를 가리켜 조회 0건·INSERT FK 위반이 난다. 로그아웃 1탭이면 빠져나온다 — 삭제된 계정이어도 [setup.ts:60-63](../../../src/lib/auth/setup.ts#L60-L63)의 어댑터가 에러를 throw하지 않고 객체로 반환하므로 버튼이 정상 동작한다.

## 9. 테스트 (TDD — 테스트 먼저)

| 파일 | 검증 |
|---|---|
| `src/lib/profile/nickname.test.ts` | 경계값 1/2/12/13자, 이모지, 공백, 자모 단독, 앞뒤 공백 trim, 대소문자 |
| `src/lib/profile/api.test.ts` | RPC 에러 코드 → `reason` 매핑, 예상 밖 에러는 throw |
| `src/lib/auth/gate.test.ts` | `nicknameSetAt` 3-상태 분기, 약관 미동의가 닉네임보다 우선 |
| `src/lib/auth/authStore.test.ts` | `signIn`이 프로필을 await해 닉네임 교체 / `bootstrap`은 블로킹하지 않음 / fetch 실패 시 카톡 이름 유지 / `setNickname` |
| `tests/db/usersSelectColumns.test.ts` | `nickname_set_at` 컬럼 존재 + `profile/api.ts`를 SOURCES에 추가 |
| `tests/screens/(auth)/nickname.test.tsx` | 프리필, 실시간 검증, 중복 에러 표시, 성공 시 라우팅 |
| `tests/screens/tabs/profile.test.tsx` | DB 닉네임 표시 + `닉네임 변경` 행 |

## 10. 범위 밖 (YAGNI)

- 프로필 사진 변경 — 별도 작업
- 닉네임 변경 이력·감사 로그
- 금칙어 필터 — 베타 규모에서 신고 기능으로 흡수
- 전화번호 검색([PRD §5.2](../../PRD.md)에 언급) — 별도 결정 필요
- 웹 게스트 닉네임 통합
