// .easignore 정합성 — EAS Build 업로드에서 앱 번들에 필요한 파일이 빠지지 않는지.
//
// 왜 필요한가 (실제로 터진 사고):
//   `.easignore`에 루트 Edge Function 폴더를 빼려고 `supabase/`라고 적었더니
//   gitignore 문법상 선행 슬래시 없는 패턴은 **모든 깊이**에 매칭되어 `src/lib/supabase/`까지
//   업로드에서 빠졌다. 로컬엔 파일이 있으니 `expo export`는 멀쩡히 통과했고,
//   EAS에서만 `Unable to resolve module @/lib/supabase/client`로 빌드가 죽었다.
//   → 로컬 재현이 불가능한 부류라 정적 가드가 유일한 방어선.
//
// EAS는 `.easignore`가 있으면 `.gitignore`를 **무시**하고 이 파일만 본다.
// 규칙 파싱은 EAS와 동일하게 `ignore` 패키지(gitignore 문법)를 쓴다.

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

import ignore from 'ignore';

const ROOT = join(__dirname, '..', '..');

const ig = ignore().add(readFileSync(join(ROOT, '.easignore'), 'utf8'));

/** 네이티브 빌드가 실제로 읽는 루트 파일. */
const REQUIRED_ROOT_FILES = [
  'package.json',
  'package-lock.json',
  'app.config.ts',
  'eas.json',
  'babel.config.js',
  'tsconfig.json',
  '.npmrc',
];

/** 앱 번들 그래프 + prebuild가 쓰는 디렉토리 (git 추적 파일 기준). */
function trackedFiles(dirs: string[]): string[] {
  return execSync(`git ls-files ${dirs.join(' ')}`, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1e8,
  })
    .trim()
    .split('\n')
    .filter(Boolean);
}

describe('.easignore', () => {
  it('앱 번들·prebuild에 필요한 파일을 하나도 제외하지 않는다', () => {
    const required = [
      ...trackedFiles(['src', 'app', 'assets', 'plugins', 'patches']),
      ...REQUIRED_ROOT_FILES,
    ];
    expect(required.length).toBeGreaterThan(100); // git ls-files가 빈 결과면 테스트가 무의미
    expect(required.filter((f) => ig.ignores(f))).toEqual([]);
  });

  it('src/lib/supabase는 루트 supabase/(Edge Function)와 별개로 반드시 포함된다', () => {
    // 회귀 가드 — 이 한 줄이 실제 빌드 실패의 원인이었다.
    expect(ig.ignores('src/lib/supabase/client.ts')).toBe(false);
  });

  it('용량·시크릿 위험 경로는 제외한다', () => {
    const mustExclude = [
      'node_modules/react/index.js',
      'web-guest/.next/static/chunk.js', // 138MB — tarball 100MB 초과의 주범
      'web-guest/package.json',
      'supabase/functions/votes_aggregate/index.ts',
      'android/app/build.gradle',
      'docs/PRD.md',
      'tools/figma-export/preview.mjs',
      '.env.local', // 시크릿 — env는 EAS 환경변수로 주입
    ];
    expect(mustExclude.filter((f) => !ig.ignores(f))).toEqual([]);
  });
});
