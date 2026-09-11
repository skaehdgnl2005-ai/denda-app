// 덤프 파트(out/parts/*.json)를 단일 out/dump.json으로 합친다.
// 타입체크·번들이 이 파일을 필요로 하므로 그 앞 단계로 분리했다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DateTime } from 'luxon';

const here = path.dirname(fileURLToPath(import.meta.url));
const partsDir = path.join(here, '..', 'out', 'parts');
const outFile = path.join(here, '..', 'out', 'dump.json');

if (!fs.existsSync(partsDir)) {
  console.error(
    [
      '',
      '[figma-export] 덤프 파트가 없습니다.',
      '  먼저 실행: npm run figma:dump',
      `  기대 위치: ${partsDir}`,
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const parts = fs
  .readdirSync(partsDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

const artboards = [];
const warnings = [];
for (const file of parts) {
  const part = JSON.parse(fs.readFileSync(path.join(partsDir, file), 'utf8'));
  artboards.push(...part.artboards);
  warnings.push(...part.warnings);
}

const doc = {
  // D13 — KST 명시.
  generatedAt: DateTime.now().setZone('Asia/Seoul').toISO(),
  artboards,
  warnings: [...new Set(warnings)],
};

fs.writeFileSync(outFile, JSON.stringify(doc), 'utf8');
console.log(
  `[figma-export] 파트 ${parts.length}개 병합 → 아트보드 ${artboards.length}개 · 경고 ${doc.warnings.length}건`,
);
