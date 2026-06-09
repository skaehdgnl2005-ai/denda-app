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
- **🟦 결론 ([D39](DECISIONS.md#d39--장소-검색-primary--naversearchprovider-확정-kakao-local-보류-카카오맵-심사-반려), 2026-06-08)**: 카카오맵 `OPEN_MAP_AND_LOCAL` 제품 심사 **반려** + 출시 우선 → **NaverSearchProvider primary 확정**. 카카오맵 심사 재도전 안 함. Kakao 평가 트랙 보류.
- **출시 prereq (1개)**: `supabase functions deploy naver_local_search` (현재 미배포 — 배포 즉시 앱 장소 검색 동작. NAVER_CLIENT_ID/SECRET 등록·검증 완료).
- **Kakao 자산 dormant**: KakaoLocalProvider·kakao_local·kakao_local_search (TDD green 보존, 미사용 — 추후 카카오맵 승인 시 provider 주입 교체로 무비용 재활성).
- **미ship**: `/ship-task` 미실행 (SESSION_LOG·PROGRESS·TASK_BACKLOG promote 대기)
- **⚠️ 본 빌드와 무관한 기존 실패**: `tests/screens/schedule/map.test.tsx` 2건(S15 async point 렌더) — import 커플링 0, 별도 조사 대상 (2026-06-08 확인: 현재 6/6 green, 해소됨)

### S-MAP M0+① — 지도 렌더 활성화 기반(MapHost) + 동선·일정 지도

- **상태**: M0+① DONE (2026-06-08, 별도 feat 브랜치 커밋) · M2~M4 TODO
- **한 일**: MapScene 계약 + MapHost 단일 경계(`isMapAvailable` env 게이트 + lazy NaverMapScene, D25) + MapPlaceholder("리스트로 보기" 유도) + `@mj-studio/react-native-naver-map@2.9.0` 설치 + `app.config.ts` 조건부 플러그인(Kakao 패턴) + `app/schedule/map.tsx` placeholder→MapHost. jest 933 / typecheck 0 / lint 0. [D38](DECISIONS.md#d38--지도-렌더-seam--maphost-단일-경계--mapscene-계약--ismapavailable-env-게이트)
- **활성화 게이트(사용자/운영)**: 네이버 Maps Client ID 발급 → `.env` `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID` + `EXPO_PUBLIC_MAP_ENABLED=true` → `expo prebuild && expo run:android` → **코드 변경 0으로 점등**.
- **다음**: M3(중간지점+출발지 입력 Q-B23) → M4(제휴 마커 Q-B13). **M2(검색→확정·Gate #2 click 정확도 + 마커 actionId 통일) DONE 2026-06-09**. 설계: `docs/superpowers/specs/2026-06-08-map-feature-activation-design.md`
- **▶ 다음 세션 시작점**: `docs/superpowers/specs/2026-06-08-map-m2-handoff.md` (현재 상태·진입법·주의)
