// EAS env manifest 정합성 — 코드가 소비하는 EXPO_PUBLIC_* 키는 전부 .env.eas.example에
// 문서화되어야 한다. 누락되면 EAS 빌드에서 해당 env 미주입 → 기능이 조용히 죽는다
// (예: EXPO_PUBLIC_MAP_ENABLED 누락 → preview 빌드에서 지도 전체 비활성).
// manifest는 "어떤 env가 어디에 사는가"의 단일 진실이므로 주석 문서화도 인정한다.

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const SCAN_DIRS = ['src', 'app'];
const MANIFEST = join(ROOT, '.env.eas.example');

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function collectUsedEnvKeys(): Set<string> {
  const keys = new Set<string>();
  for (const dir of SCAN_DIRS) {
    for (const file of collectSourceFiles(join(ROOT, dir))) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/process\.env\.(EXPO_PUBLIC_\w+)/g)) {
        const key = match[1];
        if (key !== undefined) keys.add(key);
      }
    }
  }
  return keys;
}

describe('.env.eas.example manifest 정합성', () => {
  test('코드가 소비하는 모든 EXPO_PUBLIC_* 키가 manifest에 문서화되어 있다', () => {
    const used = collectUsedEnvKeys();
    expect(used.size).toBeGreaterThan(0); // 스캐너 자체 고장 가드

    const manifest = readFileSync(MANIFEST, 'utf8');
    const missing = [...used].filter((key) => !manifest.includes(key)).sort();

    // 누락 키가 있으면 이 단언 메시지가 곧 할 일 목록이다.
    expect(missing).toEqual([]);
  });
});
