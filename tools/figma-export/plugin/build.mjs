// Figma 플러그인 번들. dump.json을 코드에 함께 넣는다 —
// 일회성 부트스트랩이라 로컬 서버도, 파일 업로드 UI도 필요 없다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(here, '..', 'out', 'dump.json');

if (!fs.existsSync(outFile)) {
  console.error(
    [
      '',
      '[figma-export] dump.json이 없습니다.',
      '  먼저 실행: npm run figma:dump && npm run figma:merge',
      `  기대 위치: ${outFile}`,
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const doc = JSON.parse(fs.readFileSync(outFile, 'utf8'));

await esbuild.build({
  entryPoints: [path.join(here, 'code.ts')],
  outfile: path.join(here, 'code.js'),
  bundle: true,
  format: 'iife',
  target: 'es2017',
  legalComments: 'none',
  logLevel: 'info',
});

const bytes = fs.statSync(path.join(here, 'code.js')).size;
console.log(
  `\n[figma-export] 플러그인 번들 완료\n` +
    `  아트보드 ${doc.artboards.length}개 · 경고 ${doc.warnings.length}건\n` +
    `  번들 크기 ${(bytes / 1024).toFixed(0)}KB\n\n` +
    `  Figma 데스크톱 → Plugins → Development → Import plugin from manifest…\n` +
    `  선택: ${path.join(here, 'manifest.json')}\n`,
);
