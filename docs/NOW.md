# Now — 현재 진행 중

> 활성 작업의 라이브 상태판. 중단/재개 시 컨텍스트 복원 단일 위치.
>
> **규칙**:
> - 항목 추가: `/start-task`가 처리 (skill §3.5)
> - 항목 삭제: `/ship-task`가 promote 시 처리 (skill §2.5)
> - 50줄 hard limit. 초과 시 `/ship-task`가 정리 권유 알림.
> - 누적 history는 [SESSION_LOG](SESSION_LOG.md). 여기는 **활성 상태만**.

---

## 🟢 활성 작업

### S01 Kakao OIDC OAuth (사용자 액션 대기)
- **상태**: 코드 완료, 외부 의존성 대기 중 (`/ship-task` 보류)
- **완료**: AuthProvider 추상화 / KakaoOIDCProvider (DI) / authStore (zustand vanilla) / 라우팅 게이트 / login·terms·onboarding·home 화면 / `@react-native-kakao` Expo plugin / 39 테스트 그린, typecheck 0, lint 0
- **사용자 액션 필요** (모두 외부 portal/계정 작업 — 코드로 해소 불가):
  1. **카카오 디벨로퍼스 portal**: 앱 등록 + OpenID Connect 활성화 ON + 동의항목 `프로필 정보(닉네임)` 필수. iOS bundleId `com.denda.app` + Android key hash 등록 (EAS Build 후 keystore 기반)
  2. **Supabase Auth dashboard**: Authentication → Providers → Kakao → Enable + Client ID(REST API key) 입력
  3. **.env.local 채우기**: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY`, `EXPO_PUBLIC_KAKAO_REST_API_KEY`
  4. **Supabase 마이그레이션 배포**: `supabase db push` (또는 SQL editor) — `0003_kakao_oidc_amend.sql` 적용 후 스모크 테스트로 id_token raw_user_meta_data claim 키 확인
  5. **Native build 셋업**: Kakao native SDK는 Expo Go 미지원 — Expo Dev Client 또는 EAS Build 필요 (S13 의존)
  6. **패키지 PoC 결정** ([Q-A7](OPEN_QUESTIONS.md#q-a7--kakao-rn-패키지의-native-nonce-미지원--d29-nonce-검증-우회됨)): 현재 `@react-native-kakao/core+user` 2.4.5 선택 (D29 spec 권장). native nonce 미지원 → (a) 패키지 PR (b) `@react-native-seoul/kakao-login` 교체 (c) 수용 — 결정 후 setup.ts 어댑터 1줄만 변경
- **블로커**: 사용자 액션 1~5 완료 + Q-A7 결정 후 실제 device에서 카카오 로그인 1회 → `auth.users` 행 생성 확인되면 `/ship-task` 진행
- **다음 단계 (사용자 액션 후)**: 실기기 스모크 테스트 → SESSION_LOG에 결과 기록 → `/ship-task S01`
- **마지막 update**: 2026-05-23
