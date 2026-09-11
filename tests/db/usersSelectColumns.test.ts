// users 테이블 select 컬럼 계약 — 마이그레이션 스키마에 없는 컬럼을 조회하지 않는지.
//
// 왜 필요한가 (실제로 터진 사고):
//   friendsApi가 `.select('id, nickname, avatar_url')`를 보냈는데 users 테이블의 실제 컬럼은
//   `profile_image_url`이다. PostgREST는 42703(column does not exist)로 **400을 반환**하고,
//   api가 "검색하지 못했어요"를 throw → 화면은 결과 0건처럼 보인다.
//   친구 목록·검색·요청함·모임 초대 5개 쿼리가 전부 같은 이유로 죽어 있었다.
//
//   기존 단위 테스트는 supabase 클라이언트를 mock 하므로 이 부류를 원리적으로 못 잡는다.
//   (mock은 select 문자열을 검증하지 않고 가짜 데이터를 그대로 돌려준다.)
//   실 DB 없이 잡으려면 마이그레이션 SQL을 진실로 삼는 정적 대조가 유일한 방법.
//
// 근본 해결책은 `supabase gen types typescript`로 생성한 타입을 클라이언트에 물려
// 컴파일 에러로 만드는 것 — 그건 별도 트랙. 그때까지 이 테스트가 방어선이다.

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');

/** 정규식 캡처 그룹 narrowing (strict). 매칭됐는데 그룹이 없으면 파서 버그이므로 즉시 실패. */
function group(match: RegExpExecArray, index: number): string {
  const value = match[index];
  if (value === undefined) throw new Error(`정규식 그룹 ${index} 누락 — 파서 점검 필요`);
  return value;
}

/** 마이그레이션 SQL을 순서대로 적용해 public.users의 최종 컬럼 집합을 구한다. */
function usersColumnsFromMigrations(): Set<string> {
  const columns = new Set<string>();
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');

    // CREATE TABLE public.users ( ... );
    const create = /CREATE TABLE public\.users\s*\(([\s\S]*?)\n\);/.exec(sql);
    if (create) {
      for (const rawLine of group(create, 1).split('\n')) {
        const line = rawLine.trim();
        // 컬럼 정의만 — 테이블 레벨 제약(PRIMARY KEY/CHECK/...)과 주석은 건너뛴다.
        if (!line || line.startsWith('--')) continue;
        if (/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(line)) continue;
        const name = /^([a-z_][a-z0-9_]*)/i.exec(line);
        if (name) columns.add(group(name, 1));
      }
    }

    // ALTER TABLE public.users ... ADD/DROP COLUMN (개행 허용)
    const alterRe = /ALTER TABLE public\.users\s+([\s\S]*?);/g;
    let alter: RegExpExecArray | null;
    while ((alter = alterRe.exec(sql)) !== null) {
      const body = group(alter, 1);
      const add = /ADD COLUMN(?:\s+IF NOT EXISTS)?\s+([a-z_][a-z0-9_]*)/i.exec(body);
      if (add) columns.add(group(add, 1));
      const drop = /DROP COLUMN(?:\s+IF EXISTS)?\s+([a-z_][a-z0-9_]*)/i.exec(body);
      if (drop) columns.delete(group(drop, 1));
    }
  }
  return columns;
}

/**
 * 소스에서 users 컬럼을 조회하는 select 조각을 뽑는다.
 * users를 조회하는 곳은 전부 `nickname`을 포함하므로 이를 마커로 쓴다.
 *   - 직접 조회:  .select('id, nickname, profile_image_url')
 *   - 조인 조회:  .select('..., friend:friend_id(id, nickname, profile_image_url)')
 */
function userColumnRefs(source: string): { fragment: string; columns: string[] }[] {
  const refs: { fragment: string; columns: string[] }[] = [];
  // `.select(` 와 문자열 사이에 주석/개행이 끼어도 놓치지 않는다.
  const selectRe = /\.select\(\s*(?:\/\/[^\n]*\n\s*)*'([^']*)'/g;
  let m: RegExpExecArray | null;

  while ((m = selectRe.exec(source)) !== null) {
    const selectString = group(m, 1);
    const fragments: string[] = [];

    // 조인 그룹 alias:fk(col, col) 을 먼저 수집하고, 남은 최상위 목록을 별도 조각으로.
    const groupRe = /[a-z_]+:[a-z_]+\(([^)]*)\)/gi;
    let g: RegExpExecArray | null;
    while ((g = groupRe.exec(selectString)) !== null) fragments.push(group(g, 1));
    fragments.push(selectString.replace(groupRe, ''));

    for (const fragment of fragments) {
      if (!/\bnickname\b/.test(fragment)) continue; // users 조회가 아님
      const columns = fragment
        .split(',')
        .map((c) => c.trim())
        // PostgREST 별칭 표기 `alias:real_column` → 실제 컬럼명만 검사
        .map((c) => (c.includes(':') ? (c.split(':')[1] ?? c).trim() : c))
        .filter(Boolean);
      refs.push({ fragment: fragment.trim(), columns });
    }
  }
  return refs;
}

const SOURCES = [
  'src/lib/friends/api.ts',
  'src/lib/groups/invitations.ts',
  'src/lib/profile/api.ts',
];

describe('users select 컬럼 계약', () => {
  const usersColumns = usersColumnsFromMigrations();

  it('마이그레이션에서 users 스키마를 읽는다', () => {
    // 파서가 깨지면 아래 테스트가 조용히 통과해버리므로 스키마 자체를 먼저 고정.
    expect(usersColumns.has('nickname')).toBe(true);
    expect(usersColumns.has('profile_image_url')).toBe(true);
    expect(usersColumns.has('email')).toBe(true); // 0003 ADD COLUMN
    expect(usersColumns.has('calendar_preference')).toBe(true); // 0011 ADD COLUMN (개행)
    expect(usersColumns.has('nickname_set_at')).toBe(true); // 0024 ADD COLUMN
    expect(usersColumns.has('synthetic_email')).toBe(false); // 0003 DROP COLUMN
  });

  // 0024는 ADD CONSTRAINT / DROP CONSTRAINT도 쓴다 — 파서가 이를 컬럼으로 오인하면
  // 존재하지 않는 컬럼이 통과해버린다.
  it('제약 조건을 컬럼으로 오인하지 않는다', () => {
    expect(usersColumns.has('users_nickname_format_check')).toBe(false);
  });

  it.each(SOURCES)('%s — 존재하지 않는 users 컬럼을 조회하지 않는다', (relPath) => {
    const source = readFileSync(join(ROOT, relPath), 'utf8');
    const refs = userColumnRefs(source);

    // 추출기가 0건이면 테스트가 무의미해지므로 방어.
    expect(refs.length).toBeGreaterThan(0);

    const unknown = refs.flatMap(({ fragment, columns }) =>
      columns.filter((c) => !usersColumns.has(c)).map((c) => `${c}  (in: ${fragment})`),
    );
    expect(unknown).toEqual([]);
  });
});
