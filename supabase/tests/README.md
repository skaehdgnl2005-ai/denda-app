# 데이터 접근 회귀 테스트

운영/스테이징 주소나 키를 받지 않는 **폐기형 인메모리 PostgreSQL** 테스트다.
Node.js 20+에서 저장소 루트 기준:

```sh
npm ci --prefix supabase/tests
npm run reproduce --prefix supabase/tests
npm test --prefix supabase/tests
```

- `reproduce`: 0025를 제외한 마이그레이션으로 기존 취약점 두 건을 재현한다.
  가짜 사용자 3명 조회, 가짜 게스트 토큰 수확 후 해당 투표 삭제를 실제 SQL로 확인한다.
- `test`: 0025 포함 마이그레이션, anon/authenticated 역할 전환, JWT sub 모사,
  Supabase 기본 테이블 grant를 구성하여 21개 권한·기능 시나리오를 검증한다.
- SQL/RLS/RPC는 모킹하지 않는다. auth 스키마·`auth.uid()`는 최소 테스트 대체물이다.
- PGlite 0.5.8 (PostgreSQL 18.3). 저장소 설정의 Supabase PG17 및 PostgREST 통합과
  완전히 동일하지 않다. `0006` (pg_net 알림 트리거), `0010` (pg_cron)만 제외한다.
  이 둘의 알림 전송, 실제 JWT/PostgREST, 병렬 세션의 잠금 경합은 스테이징에서 별도 확인한다.
- 외부 연결이나 실제 데이터에 대한 공격은 수행하지 않는다.

웹 검증: `cd web-guest && npm test -- --runInBand`, `npx tsc --noEmit`, `npm run lint`.
브라우저 검증은 Playwright 환경 설치 후 `npm run e2e`로 실행한다.
