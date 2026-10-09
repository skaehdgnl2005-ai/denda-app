# SEC-1 / SEC-2 검증 및 수정안 — 2026-10-09

기준: `feat/map-maphost-m0`, `062d4f4d2e2b937e3948ebca1c78a65621da11d3`.
상태: 격리 DB 재현·수정·회귀 검증 완료. 운영 적용 및 브라우저 E2E는 미완료.

## 확인 결과

| 항목 | 저장소 현재 영향 | 재현 |
|---|---|---|
| SEC-1 | `auth.uid()`가 NULL인 anon이 차단 여부 함수의 false 결과를 통해 사용자 전체 행을 읽음. 닉네임뿐 아니라 kakao_id, email, phone, profile_image_url 등 SELECT 허용 | 가짜 사용자 3명의 email/kakao_id가 anon SELECT에 반환됨 |
| SEC-2 | group_guests 및 votes의 공개 SELECT로 수정 자격증명인 guest_token 노출. save_guest_votes는 토큰 소유만 검사하므로 수확한 토큰으로 타인 투표 대체/삭제 가능 | anon이 가짜 피해자 토큰을 읽고 RPC에 빈 배열을 전달하여 피해자 투표를 삭제함 |
| SEC-3 (관련 경로) | groups_select_anon의 USING(true)는 클라이언트의 `.eq(id)`와 무관하게 모든 모임 열람 허용 | 새 회귀 테스트에서 전체 스캔 차단 확인 |

0001~0024 후속 마이그레이션을 확인했다. 0022는 RLS 재귀만 수정하며 공개 정책을
삭제하지 않는다. 0007의 차단 조건도 permissive SELECT 정책끼리 OR 결합되므로
0004의 USING(true)를 막지 못한다. RPC 구현도 0004 이후 변경되지 않았다.

이 결과는 **저장소 스키마와 Supabase 기본 grant를 재현한 DB에 대한 확인**이다.
운영 DB의 적용 이력, 실제 grants/정책, 사용자 수, 유출/변조 발생 여부는 확인하지 않았다.
운영 주소·키를 사용하지 않았고 실제 사용자 정보를 조회하지 않았다.

## 수정

- 새 `0025_guest_access_hardening.sql`을 추가. 기존 마이그레이션 이력은 보존한다.
- users SELECT를 authenticated + non-null UID로 제한하고 기존 차단 규칙을 유지한다.
- groups/group_guests/votes의 무조건 허용 SELECT와 게스트 직접 INSERT를 제거한다.
- group_guests에 무작위 `guest_id`를 추가. `guest_token`은 내부 FK와 비밀 자격증명으로 유지한다.
- anon뿐 아니라 authenticated/PUBLIC의 테이블 SELECT를 회수하고, 로그인 회원에게는
  RLS를 통과하는 안전한 컬럼만 재부여한다. 회원/호스트도 guest_token을 읽거나 필터링할 수 없다.
- `register_guest`: 모임 UUID 및 닉네임 검증 후 서버가 생성한 본인 토큰만 반환한다.
- `get_guest_session`: 모임 UUID + 비밀 토큰으로 기존 브라우저의 닉네임을 복원한다.
- `get_guest_group_view`: UUID 링크를 아는 사람에게 필요한 모임명/날짜/닉네임/참여 현황/
  서버 집계 히트맵만 반환한다. 본인 슬롯은 비밀 토큰을 제시했을 때만 반환한다.
  사용자 PII, 타인의 개별 슬롯, 토큰은 반환하지 않는다. 로그인 호출에는 차단 규칙을 적용한다.
- `save_guest_votes`: 고정 search_path, 명시적 EXECUTE, 게스트 행 잠금, 모임+토큰 범위의
  DELETE, 날짜/15분 슬롯/배열/크기 검증. 잘못된 입력은 기존 투표를 지우지 않는다.
- 웹의 SSR/초대 메타데이터, 등록, 재진입, 참여 현황, 투표 복원, broadcast 이후 새로고침을
  RPC로 교체. 토큰을 공개 식별자로 사용하지 않으며 클라이언트 raw votes 합산을 제거한다.
- 기존 게스트 토큰·투표·attribution FK를 보존한다. 재진입 시 본인 슬롯이 로드될 때까지
  편집 그리드 표시를 기다리고, 통신 장애를 토큰 무효로 오인해 자격증명을 지우지 않는다.

## 실행 결과

| 검증 | 결과 |
|---|---|
| 기존 취약점 재현 (`npm run reproduce --prefix supabase/tests`) | 2/2 재현 |
| 수정 DB 회귀 (`npm test --prefix supabase/tests`) | 21/21 통과 |
| 웹 Jest (`npm test -- --runInBand`) | 8 suites, 99 tests 통과 |
| 웹 TypeScript (`tsc --noEmit`) | 통과 |
| 웹 ESLint | 오류 0, 경고 0 |
| 웹 프로덕션 빌드 (가짜 Supabase URL/key) | 통과 |
| Playwright 브라우저 E2E | 미실행 — Chromium 다운로드 파일이 잘못된 ZIP으로 반환되어 설치 실패 |

DB 테스트는 PostgreSQL 18.3/PGlite 0.5.8의 실제 RLS/PLpgSQL을 실행한다.
Supabase의 PG17/PostgREST/JWT를 직접 실행한 것은 아니다. auth.uid()는 테스트용 GUC
함수로 대체했고 기본 grants를 모사했다. pg_net/pg_cron 마이그레이션 0006/0010은 제외했다.
따라서 실제 PostgREST 컬럼 권한 응답, Realtime/Edge 알림, 병렬 연결 잠금은 미검증이다.

웹 `npm ci`는 기존 lockfile의 @emnapi 항목 불일치로 실패했다.
`npm install --package-lock=false`로 로컬 의존성을 설치하여 검증했으며 기존 lockfile은
변경하지 않았다. `supabase/tests`에는 별도의 정확한 버전 및 lockfile을 포함했다.

## 배포 전 승인 및 남은 조치

1. 담당자가 스테이징의 실제 migration history, pg_policies, 테이블/컬럼 grants,
   함수 owner/search_path/EXECUTE를 확인한다. 운영 조회가 필요하면 접근 범위를 먼저 승인받는다.
2. 스테이징에 0025와 웹을 함께 적용하고 anon/회원/호스트의 REST 조회 거부, 등록·재진입·
   자기 투표 저장, 다른 토큰/guest_id 거부, 히트맵/알림, 두 연결 동시 저장을 확인한다.
   링크 UUID는 계속 읽기·참여 capability다. 로그아웃 익명인에게 회원 차단 신원 판별은 불가능하다.
3. **과거 유출 토큰 처리 결정은 출시 전 필수다.** 이 수정은 새로운 열람 경로를 막지만
   이미 수집된 bearer token을 무효화하지 않는다. 기존 토큰을 보존하는 이유는 기존 게스트
   재진입·투표 연속성이다. 유출 가능성을 배제할 수 없으면, 별도 승인된 토큰 폐기/재발급을
   수행해야 한다. 기존 브라우저 재인증/재등록 및 남아 있는 투표의 처리 방식을 먼저 확정한다.
   FK가 votes와 branch_attributions에 연결되어 있으므로 단순 PK UPDATE/DELETE를 실행하지 않는다.
4. 담당자의 승인 후 운영 백업/복구 계획을 준비하고 **0025 DB 변경과 새 웹을 조율해 배포**한다.
   구 웹은 직접 SELECT/INSERT에 의존하므로 DB만 먼저 바꾸면 일시적으로 동작하지 않는다.
   짧은 점검 창 또는 RPC 선배포→웹 전환→권한 회수의 단계적 배포를 별도 검토한다.
5. 수정 브랜치는 자동 배포하지 않았고 운영 DB에 `db push`, SQL 실행, 토큰 폐기 또는
   데이터 변경을 수행하지 않았다. 이 보고서만으로 출시 승인이나 운영 노출 해소를 선언하지 않는다.

SEC-4/SEC-5 및 다른 인증·attribution/Edge 경로의 전체 보안 감사는 이번 두 항목의 범위 밖이다.
