// 덤프 러너 공용 출력 헬퍼.
// 러너마다 out/parts/<name>.json을 쓰고, plugin/build.mjs가 이를 합쳐 dump.json을 만든다.
// 화면을 추가할 때 기존 러너를 건드릴 필요가 없다.
import fs from 'fs';
import path from 'path';

import type { IRArtboard, IRNode } from './ir';

export interface DumpPart {
  artboards: IRArtboard[];
  warnings: string[];
}

const PARTS_DIR = path.join(__dirname, 'out', 'parts');

function countKinds(nodes: IRNode[]): Map<string, number> {
  const out = new Map<string, number>();
  const visit = (n: IRNode): void => {
    out.set(n.kind, (out.get(n.kind) ?? 0) + 1);
    if (n.kind === 'frame') n.children.forEach(visit);
  };
  nodes.forEach(visit);
  return out;
}

/** 파트를 디스크에 쓰고 요약을 콘솔에 남긴다 (덤프가 조용히 비어 나오는 것 방지). */
export function emitPart(name: string, part: DumpPart): string {
  fs.mkdirSync(PARTS_DIR, { recursive: true });
  const file = path.join(PARTS_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(part, null, 2), 'utf8');

  const kinds = countKinds(part.artboards.map((a) => a.root));
  const unique = [...new Set(part.warnings)];

  // eslint-disable-next-line no-console
  console.log(
    `\n[figma-export:${name}] 아트보드 ${part.artboards.length}개 → ${file}\n` +
      `  노드: ${[...kinds.entries()].map(([k, v]) => `${k} ${v}`).join(' · ')}\n` +
      `  경고: ${unique.length}건\n` +
      unique
        .slice(0, 15)
        .map((w) => `    - ${w}`)
        .join('\n'),
  );

  return file;
}
