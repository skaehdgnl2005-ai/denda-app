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

### S16 Phase b — KakaoLocalProvider (Q-A2 허용 → D37)

- **상태**: 코드 빌드 완료 (TDD green) · **미ship** · 운영 prereq 대기
- **배경**: 카카오 "허용" 답변 수신(2026-06-01, [D37](DECISIONS.md#d37--q-a2-카카오-local-api-약관-허용-답변-수신--kakaolocalprovider-평가-트랙)). NaverSearchProvider(D36)와 같은 `PlaceSearchProvider` 인터페이스로 추가 → 데이터 quality 비교 후 우위 시 primary 교체.
- **완료 (TDD, 44 tests green)**:
  - `supabase/functions/_lib/kakao_local.ts` (+`_test.ts` 23✓) — 좌표(WGS84 decimal)·카테고리(group 우선)·파싱·fetch
  - `supabase/functions/kakao_local_search/index.ts` (+`_test.ts` 13✓) — Edge proxy, `KAKAO_REST_API_KEY` Edge env (rule 7)
  - `src/lib/places/KakaoLocalProvider.ts` (+`.test.ts` 8✓) — invoke 클라이언트 (NaverSearchProvider 미러)
  - typecheck 0 / eslint 0 / Naver 회귀 0
- **다음 (founder 운영 트랙)**:
  1. ✅ `KAKAO_REST_API_KEY` 등록 + `kakao_local_search` 배포 (2026-06-08)
  2. ⚠️ **Kakao Local 403 `App disabled OPEN_MAP_AND_LOCAL service`** → 카카오맵 제품은 토글이 아니라 **심사 제출**(서비스 URL + 적용 화면 스크린샷 + 활용 시나리오). 승인 후에야 Kakao 호출 가능 — "허용 답변" 뒤에 숨은 운영 게이트(D37 "운영 정책 준수"의 실체).
  3. 심사 제출용 스크린샷 위해 `naver_local_search` 배포 필요(출시에도 필수, 현재 미배포). 배포 후 앱 검색 화면 캡처.
  4. 승인 후: live 데이터 quality 비교(Naver vs Kakao) → primary 확정(후속 D 또는 D37 갱신)
- **현재 가능**: Naver는 raw API 검증 완료(6쿼리 5/5, 카테고리·주소 100%). Kakao는 심사 승인까지 비교 보류.
- **미ship**: `/ship-task` 미실행 (SESSION_LOG·PROGRESS·TASK_BACKLOG promote 대기)
- **⚠️ 본 빌드와 무관한 기존 실패**: `tests/screens/schedule/map.test.tsx` 2건(S15 async point 렌더) — import 커플링 0, 별도 조사 대상 (2026-06-08 확인: 현재 6/6 green, 해소됨)

### S-MAP M0+① — 지도 렌더 활성화 기반(MapHost) + 동선·일정 지도

- **상태**: M0+① DONE (2026-06-08, 별도 feat 브랜치 커밋) · M2~M4 TODO
- **한 일**: MapScene 계약 + MapHost 단일 경계(`isMapAvailable` env 게이트 + lazy NaverMapScene, D25) + MapPlaceholder("리스트로 보기" 유도) + `@mj-studio/react-native-naver-map@2.9.0` 설치 + `app.config.ts` 조건부 플러그인(Kakao 패턴) + `app/schedule/map.tsx` placeholder→MapHost. jest 933 / typecheck 0 / lint 0. [D38](DECISIONS.md#d38--지도-렌더-seam--maphost-단일-경계--mapscene-계약--ismapavailable-env-게이트)
- **활성화 게이트(사용자/운영)**: 네이버 Maps Client ID 발급 → `.env` `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID` + `EXPO_PUBLIC_MAP_ENABLED=true` → `expo prebuild && expo run:android` → **코드 변경 0으로 점등**.
- **다음**: M2(검색→장소 확정·Gate #2) → M3(중간지점+출발지 입력 Q-B23) → M4(제휴 마커 Q-B13). 설계: `docs/superpowers/specs/2026-06-08-map-feature-activation-design.md`
