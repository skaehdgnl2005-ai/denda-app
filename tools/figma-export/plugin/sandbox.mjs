// Figma Plugin API 샌드박스 — 번들된 code.js를 실제 dump.json으로 끝까지 실행한다.
//
// 왜 필요한가: 플러그인 코드는 Figma 런타임 안에서만 돌아서 다른 테스트가 닿지 않는다.
// 여기서 enum 허용값·폰트 로드 순서·SVG 파싱·resize 하한 같은 Figma의 실제 제약을
// 흉내 내 위반을 잡는다. Figma를 켜기 전에 터질 것을 미리 터뜨리는 것이 목적.
//
// 실행: npm run figma:verify
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE = path.join(here, 'code.js');

if (!fs.existsSync(BUNDLE)) {
  console.error('\n[figma-export] code.js가 없습니다. 먼저 실행: npm run figma:build\n');
  process.exit(1);
}

/** 이 머신에 설치돼 있다고 가정할 폰트. 시나리오별로 바꾼다. */
let INSTALLED = new Set();

const stats = {
  pages: [],
  nodes: { frame: 0, text: 0, svg: 0 },
  fontLoads: [],
  fontFails: [],
  errors: [],
  assigned: new Map(),
  svgStrings: [],
  closeMessage: null,
  notify: null,
};

function track(prop, value) {
  if (prop === 'parent' || prop.startsWith('__')) return;
  if (!stats.assigned.has(prop)) stats.assigned.set(prop, new Set());
  const set = stats.assigned.get(prop);
  if (set.size >= 12) return;
  let repr;
  if (value === null || typeof value !== 'object') {
    repr = String(value);
  } else {
    try {
      repr = JSON.stringify(value)?.slice(0, 60) ?? '[object]';
    } catch {
      repr = '[circular]';
    }
  }
  set.add(repr);
}

// Figma의 실제 제약을 흉내 내 위반을 잡는다.
const ENUMS = {
  layoutMode: ['NONE', 'HORIZONTAL', 'VERTICAL', 'GRID'],
  primaryAxisAlignItems: ['MIN', 'MAX', 'CENTER', 'SPACE_BETWEEN'],
  counterAxisAlignItems: ['MIN', 'MAX', 'CENTER', 'BASELINE'],
  layoutWrap: ['NO_WRAP', 'WRAP'],
  layoutSizingHorizontal: ['FIXED', 'HUG', 'FILL'],
  layoutSizingVertical: ['FIXED', 'HUG', 'FILL'],
  layoutPositioning: ['AUTO', 'ABSOLUTE'],
  strokeAlign: ['CENTER', 'INSIDE', 'OUTSIDE'],
  textAlignHorizontal: ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'],
};

let idSeq = 0;

function makeNode(type) {
  const self = {
    __type: type,
    id: `n${++idSeq}`,
    children: [],
    parent: null,
    _w: type === 'FRAME' ? 100 : 24,
    _h: type === 'FRAME' ? 100 : 24,
    get width() { return this._w; },
    get height() { return this._h; },
    appendChild(child) {
      if (!child) { stats.errors.push('appendChild(null)'); return; }
      if (child.parent) child.parent.children = child.parent.children.filter((c) => c !== child);
      child.parent = this;
      this.children.push(child);
    },
    resize(w, h) {
      if (!(w >= 0.01) || !(h >= 0.01)) {
        stats.errors.push(`resize(${w}, ${h}) — Figma는 0.01 미만을 거부한다`);
        return;
      }
      this._w = w; this._h = h;
    },
    rescale(f) {
      if (!(f > 0)) { stats.errors.push(`rescale(${f}) — 양수여야 한다`); return; }
      this._w *= f; this._h *= f;
    },
  };

  return new Proxy(self, {
    set(target, prop, value) {
      if (typeof prop === 'string') {
        track(prop, value);
        const allowed = ENUMS[prop];
        if (allowed && !allowed.includes(value)) {
          stats.errors.push(`${type}.${prop} = ${JSON.stringify(value)} — 허용값 아님 (${allowed.join('|')})`);
        }
        if (prop === 'characters' && typeof value !== 'string') {
          stats.errors.push(`TEXT.characters에 non-string: ${typeof value}`);
        }
        if (prop === 'fontSize' && !(value > 0)) {
          stats.errors.push(`TEXT.fontSize = ${value}`);
        }
        if ((prop === 'fills' || prop === 'strokes') && !Array.isArray(value)) {
          stats.errors.push(`${prop}에 배열이 아닌 값: ${typeof value}`);
        }
        if (prop === 'effects' && Array.isArray(value)) {
          for (const e of value) {
            if (e.visible === undefined || e.blendMode === undefined) {
              stats.errors.push(`Effect에 visible/blendMode 누락: ${JSON.stringify(e)}`);
            }
          }
        }
        if (prop === 'fontName' && (!value || !value.family || !value.style)) {
          stats.errors.push(`fontName 형태 오류: ${JSON.stringify(value)}`);
        }
        // 텍스트는 폰트 로드 후에만 characters/fontSize 설정 가능 (Figma 실제 제약)
        if (type === 'TEXT' && (prop === 'characters' || prop === 'fontSize') && !target.__fontLoaded) {
          stats.errors.push(`폰트 로드 전에 TEXT.${prop} 설정 — Figma에서 throw한다`);
        }
        if (type === 'TEXT' && prop === 'fontName') target.__fontLoaded = true;
      }
      target[prop] = value;
      return true;
    },
  });
}

globalThis.figma = {
  mixed: Symbol('mixed'),
  root: { children: [] },
  async loadAllPagesAsync() {},
  async loadFontAsync(font) {
    const key = `${font.family} / ${font.style}`;
    if (!INSTALLED.has(key)) {
      stats.fontFails.push(key);
      throw new Error(`Cannot find font ${key}`);
    }
    if (!stats.fontLoads.includes(key)) stats.fontLoads.push(key);
  },
  createPage() {
    const p = makeNode('PAGE');
    stats.pages.push(p);
    return p;
  },
  createFrame() { stats.nodes.frame++; return makeNode('FRAME'); },
  createText() { stats.nodes.text++; return makeNode('TEXT'); },
  createNodeFromSvg(svg) {
    stats.nodes.svg++;
    stats.svgStrings.push(svg);
    if (typeof svg !== 'string' || !svg.startsWith('<svg')) {
      stats.errors.push(`createNodeFromSvg에 잘못된 입력: ${String(svg).slice(0, 40)}`);
    }
    // 태그 균형 확인 (Figma는 파싱 실패 시 throw한다)
    const opens = (svg.match(/<(?!\/)[a-z]/g) || []).length;
    const closes = (svg.match(/<\//g) || []).length;
    const selfClose = (svg.match(/\/>/g) || []).length;
    if (opens !== closes + selfClose) {
      stats.errors.push(`SVG 태그 불균형: open=${opens} close=${closes} self=${selfClose}`);
    }
    const n = makeNode('FRAME');
    const m = /width="(\d+(?:\.\d+)?)"/.exec(svg);
    if (m) { n._w = Number(m[1]); n._h = Number(m[1]); }
    return n;
  },
  notify(msg) { stats.notify = msg; },
  closePlugin(msg) { stats.closeMessage = msg ?? null; },
};

function countTree(node, acc = { total: 0, depth: 0 }, d = 0) {
  acc.total++;
  acc.depth = Math.max(acc.depth, d);
  for (const c of node.children) countTree(c, acc, d + 1);
  return acc;
}

async function run(label, installed) {
  INSTALLED = new Set(installed);
  idSeq = 0;
  Object.assign(stats, {
    pages: [], nodes: { frame: 0, text: 0, svg: 0 }, fontLoads: [], fontFails: [],
    errors: [], assigned: new Map(), svgStrings: [], closeMessage: null, notify: null,
  });

  const src = fs.readFileSync(BUNDLE, 'utf8');
  const mod = new Function(src);
  mod();
  // 플러그인의 async main()이 끝날 때까지 대기
  for (let i = 0; i < 500 && stats.closeMessage === null; i++) {
    await new Promise((r) => setImmediate(r));
  }

  console.log(`\n${'='.repeat(70)}\n■ ${label}\n${'='.repeat(70)}`);
  console.log(`페이지: ${stats.pages.map((p) => `${p.name}(${countTree(p).total - 1}노드, 깊이 ${countTree(p).depth})`).join(' · ')}`);
  console.log(`생성: frame ${stats.nodes.frame} · text ${stats.nodes.text} · svg ${stats.nodes.svg}`);
  console.log(`폰트 로드 성공: ${stats.fontLoads.join(', ') || '(없음)'}`);
  console.log(`폰트 로드 실패: ${[...new Set(stats.fontFails)].join(', ') || '(없음)'}`);
  console.log(`종료 메시지: ${stats.closeMessage}`);
  console.log(`\n주요 속성 실제 대입값:`);
  for (const k of ['layoutMode', 'primaryAxisAlignItems', 'counterAxisAlignItems', 'layoutSizingHorizontal', 'layoutSizingVertical', 'layoutPositioning', 'textAlignHorizontal', 'strokeAlign', 'layoutWrap']) {
    const v = stats.assigned.get(k);
    if (v) console.log(`  ${k}: ${[...v].join(', ')}`);
  }
  if (stats.errors.length > 0) {
    const uniq = [...new Set(stats.errors)];
    console.log(`\n❌ 오류 ${stats.errors.length}건 (고유 ${uniq.length}):`);
    uniq.slice(0, 25).forEach((e) => console.log(`   - ${e}`));
  } else {
    console.log(`\n✅ 오류 0건`);
  }
  return stats.errors.length;
}

// 시나리오 1 — Pretendard 미설치 (최악: 폴백 경로 검증)
const e1 = await run('시나리오 A — Pretendard 미설치 (폴백 경로)', ['Inter / Regular']);

// 시나리오 2 — Pretendard 설치됨 (happy path)
const e2 = await run('시나리오 B — Pretendard Variable 설치됨', [
  'Pretendard Variable / Regular', 'Pretendard Variable / Medium',
  'Pretendard Variable / SemiBold', 'Pretendard Variable / Bold',
  'Pretendard Variable / ExtraBold', 'Inter / Regular',
]);

console.log(`\n${'='.repeat(70)}`);
console.log(e1 + e2 === 0 ? '✅ 두 시나리오 모두 런타임 오류 없음' : `❌ 총 오류 ${e1 + e2}건`);
process.exit(e1 + e2 === 0 ? 0 : 1);
