// dump.json의 IR을 CSS flexbox로 재현해 미리보기 HTML을 만든다.
// IR이 애초에 flexbox에서 왔으므로 되돌리는 매핑은 거의 1:1 — Figma가 그릴 결과의 충실한 예고편.
// Figma를 열지 않고 덤프 품질을 눈으로 확인할 때 쓴다.
//
// 실행: npm run figma:preview  →  tools/figma-export/out/preview.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..', '..');
const dumpFile = path.join(here, 'out', 'dump.json');

if (!fs.existsSync(dumpFile)) {
  console.error('\n[figma-export] dump.json이 없습니다. 먼저 실행: npm run figma:dump && npm run figma:merge\n');
  process.exit(1);
}

const doc = JSON.parse(fs.readFileSync(dumpFile, 'utf8'));
const woff2 = fs.readFileSync(path.join(repo, 'assets/fonts/PretendardVariable.woff2')).toString('base64');
const OUT = path.join(here, 'out', 'preview.html');

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const rgba = (c, a = 1) =>
  `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;

const JUSTIFY = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', SPACE_BETWEEN: 'space-between' };
const ALIGN = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', BASELINE: 'baseline' };

/** IR 크기 정책 → CSS. 부모 방향을 알아야 FILL이 grow인지 stretch인지 정해진다. */
function sizeCss(value, isMainAxis, node, dim) {
  const out = [];
  if (typeof value === 'number') {
    out.push(`${dim}:${value}px`, 'flex:none');
    return out;
  }
  if (value === 'FILL' || (isMainAxis && node.layout.grow === 1)) {
    out.push(isMainAxis ? 'flex:1 1 0%' : 'align-self:stretch');
  }
  return out;
}

function boxCss(box) {
  const out = [];
  const fill = box.fills[0];
  if (fill) out.push(`background:${rgba(fill.color, fill.opacity)}`);
  const stroke = box.strokes[0];
  if (stroke && box.strokeWeight > 0) {
    out.push(`box-shadow:inset 0 0 0 ${box.strokeWeight}px ${rgba(stroke.color, stroke.opacity)}`);
  }
  const r = box.cornerRadius;
  if (r.tl || r.tr || r.br || r.bl) out.push(`border-radius:${r.tl}px ${r.tr}px ${r.br}px ${r.bl}px`);
  if (box.opacity !== 1) out.push(`opacity:${box.opacity}`);
  if (box.clipsContent) out.push('overflow:hidden');
  for (const e of box.effects) {
    if (e.type === 'DROP_SHADOW') {
      out.push(`filter:drop-shadow(${e.offset.x}px ${e.offset.y}px ${e.radius / 2}px ${rgba(e.color, e.color.a)})`);
    }
  }
  return out;
}

function render(node, parentMode) {
  const isMain = (axis) => parentMode === axis;
  const warn = node.warnings && node.warnings.length > 0;
  const title = warn ? ` title="⚠️ ${esc(node.warnings.join(' / '))}"` : '';
  const cls = warn ? ' class="warn"' : '';

  if (node.kind === 'vector') {
    const s = [
      ...sizeCss(node.layout.width, isMain('HORIZONTAL'), node, 'width'),
      ...sizeCss(node.layout.height, isMain('VERTICAL'), node, 'height'),
      'display:flex',
    ];
    return `<div${cls} style="${s.join(';')}"${title}>${node.svg}</div>`;
  }

  if (node.kind === 'text') {
    const t = node.text;
    const s = [
      `font-size:${t.fontSize}px`,
      t.lineHeight !== null ? `line-height:${t.lineHeight}px` : '',
      `letter-spacing:${t.letterSpacing}px`,
      `text-align:${t.textAlign.toLowerCase()}`,
      `font-weight:${weightOf(t.fontStyleCandidates[0])}`,
      t.fills[0] ? `color:${rgba(t.fills[0].color, t.fills[0].opacity)}` : '',
      t.tabularNums ? 'font-variant-numeric:tabular-nums' : '',
      'white-space:pre-wrap',
      ...sizeCss(node.layout.width, isMain('HORIZONTAL'), node, 'width'),
    ].filter(Boolean);
    return `<div${cls} style="${s.join(';')}"${title}>${esc(node.characters)}</div>`;
  }

  if (node.kind === 'placeholder') {
    const s = [
      ...sizeCss(node.layout.width, isMain('HORIZONTAL'), node, 'width'),
      ...sizeCss(node.layout.height, isMain('VERTICAL'), node, 'height'),
      'min-width:48px', 'min-height:32px',
      'border:1px dashed currentColor', 'opacity:.45', 'border-radius:4px',
    ];
    return `<div class="ph" style="${s.join(';')}" title="${esc(node.reason)}"></div>`;
  }

  // frame
  const l = node.layout;
  const s = [
    'display:flex',
    `flex-direction:${l.mode === 'HORIZONTAL' ? 'row' : 'column'}`,
    `justify-content:${JUSTIFY[l.primaryAxisAlignItems] ?? 'flex-start'}`,
    `align-items:${ALIGN[l.counterAxisAlignItems] ?? 'flex-start'}`,
    l.itemSpacing ? `gap:${l.itemSpacing}px` : '',
    l.paddingTop || l.paddingRight || l.paddingBottom || l.paddingLeft
      ? `padding:${l.paddingTop}px ${l.paddingRight}px ${l.paddingBottom}px ${l.paddingLeft}px`
      : '',
    l.wrap ? 'flex-wrap:wrap' : '',
    'position:relative',
    ...sizeCss(l.width, isMain('HORIZONTAL'), node, 'width'),
    ...sizeCss(l.height, isMain('VERTICAL'), node, 'height'),
    ...boxCss(node.box),
  ];
  if (l.absolute) {
    s.push('position:absolute');
    for (const side of ['top', 'right', 'bottom', 'left']) {
      if (l.absolute[side] !== undefined) s.push(`${side}:${l.absolute[side]}px`);
    }
  }
  const kids = node.children.map((c) => render(c, l.mode)).join('');
  return `<div${cls} style="${s.filter(Boolean).join(';')}"${title}>${kids}</div>`;
}

const weightOf = (style) =>
  ({ Thin: 100, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900 })[style] ?? 400;

function countNodes(n) {
  let c = 1;
  if (n.kind === 'frame') for (const k of n.children) c += countNodes(k);
  return c;
}
function countWarnings(n) {
  let c = n.warnings ? n.warnings.length : 0;
  if (n.kind === 'frame') for (const k of n.children) c += countWarnings(k);
  return c;
}

const groups = [];
for (const a of doc.artboards) if (!groups.includes(a.group)) groups.push(a.group);

const cards = doc.artboards
  .map((a) => {
    const nodes = countNodes(a.root);
    const warns = countWarnings(a.root);
    return `<figure class="card" data-theme-set="${a.theme}" data-group="${esc(a.group)}">
  <div class="stage stage--${a.theme}">${render(a.root, 'NONE')}</div>
  <figcaption>
    <span class="cap-name">${esc(a.name)}</span>
    <span class="cap-id">${esc(a.id.replace(/\/(light|dark)$/, ''))}</span>
    <span class="cap-meta">${nodes}<abbr title="레이어 수">L</abbr>${warns ? `<b class="chip">⚠️ ${warns}</b>` : ''}</span>
  </figcaption>
</figure>`;
  })
  .join('\n');

const nav = groups
  .map(
    (g) =>
      `<li><a href="#g-${encodeURIComponent(g)}"><span>${esc(g)}</span><em>${doc.artboards.filter((a) => a.group === g).length / 2}</em></a></li>`,
  )
  .join('');

const sections = groups
  .map((g) => {
    const inner = doc.artboards
      .filter((a) => a.group === g)
      .map((a) => {
        const nodes = countNodes(a.root);
        const warns = countWarnings(a.root);
        return `<figure class="card" data-set="${a.theme}">
  <div class="stage stage--${a.theme}">${render(a.root, 'NONE')}</div>
  <figcaption>
    <span class="cap-name">${esc(a.name)}</span>
    <span class="cap-meta"><code>${esc(a.id.replace(/\/(light|dark)$/, ''))}</code><span class="layers">${nodes}</span>${warns ? `<b class="chip">⚠ ${warns}</b>` : ''}</span>
  </figcaption>
</figure>`;
      })
      .join('\n');
    return `<section id="g-${encodeURIComponent(g)}">
  <h2>${esc(g)}</h2>
  <div class="grid">${inner}</div>
</section>`;
  })
  .join('\n');

const totalNodes = doc.artboards.reduce((s, a) => s + countNodes(a.root), 0);

const html = `<title>된다 — Figma 이식 미리보기</title>
<style>
@font-face{font-family:'Pretendard Variable';font-weight:45 920;font-display:block;
  src:url(data:font/woff2;base64,${woff2}) format('woff2-variations');}

:root{
  --ground:#FFFFFF; --raised:#F9FAFB; --sunken:#F3F4F6; --hairline:#E5E7EB;
  --ink:#111827; --muted:#6B7280; --faint:#9CA3AF;
  --accent:#7C3AED; --caution-fg:#B45309; --caution-bg:#FFFBEB; --caution-br:#FDE68A;
  --stage-light:#FFFFFF; --stage-dark:#0F0F12;
}
@media (prefers-color-scheme:dark){
  :root{
    --ground:#0F0F12; --raised:#16161B; --sunken:#1C1C22; --hairline:#2A2A33;
    --ink:#E8E8EF; --muted:#9A9AA8; --faint:#6E6E7C;
    --accent:#9B7AFF; --caution-fg:#F59E0B; --caution-bg:rgba(245,158,11,.10); --caution-br:rgba(245,158,11,.35);
  }
}
:root[data-theme="dark"]{
  --ground:#0F0F12; --raised:#16161B; --sunken:#1C1C22; --hairline:#2A2A33;
  --ink:#E8E8EF; --muted:#9A9AA8; --faint:#6E6E7C;
  --accent:#9B7AFF; --caution-fg:#F59E0B; --caution-bg:rgba(245,158,11,.10); --caution-br:rgba(245,158,11,.35);
}
:root[data-theme="light"]{
  --ground:#FFFFFF; --raised:#F9FAFB; --sunken:#F3F4F6; --hairline:#E5E7EB;
  --ink:#111827; --muted:#6B7280; --faint:#9CA3AF;
  --accent:#7C3AED; --caution-fg:#B45309; --caution-bg:#FFFBEB; --caution-br:#FDE68A;
}

*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);
  font-family:'Pretendard Variable',system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;letter-spacing:-.01em}
code,.layers,.cap-meta{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}

header{position:sticky;top:0;z-index:20;background:var(--ground);
  border-bottom:1px solid var(--hairline);padding:20px 24px 16px}
.brand{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
h1{font-size:20px;line-height:28px;font-weight:700;margin:0;letter-spacing:-.02em}
.sub{color:var(--muted);font-size:13px;line-height:18px}
.stats{display:flex;gap:20px;margin-top:12px;flex-wrap:wrap;
  font-size:13px;line-height:18px;color:var(--muted)}
.stats b{color:var(--accent);font-weight:600;font-variant-numeric:tabular-nums}
.stats span{display:inline-flex;gap:6px;align-items:baseline}

.switch{margin-left:auto;display:inline-flex;border:1px solid var(--hairline);
  border-radius:8px;overflow:hidden;background:var(--raised)}
.switch button{appearance:none;border:0;background:transparent;color:var(--muted);
  font:inherit;font-size:13px;font-weight:600;padding:7px 14px;cursor:pointer;min-height:36px}
.switch button[aria-pressed="true"]{background:var(--accent);color:#fff}
.switch button:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}

.wrap{display:grid;grid-template-columns:190px minmax(0,1fr);gap:32px;
  max-width:1400px;margin:0 auto;padding:28px 24px 96px}
nav{position:sticky;top:132px;align-self:start}
nav ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
nav a{display:flex;justify-content:space-between;align-items:center;gap:8px;
  text-decoration:none;color:var(--muted);font-size:14px;font-weight:500;
  padding:8px 10px;border-radius:8px;min-height:36px}
nav a:hover{background:var(--sunken);color:var(--ink)}
nav a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
nav em{font-style:normal;font-size:12px;color:var(--faint);font-variant-numeric:tabular-nums}

section{margin-bottom:56px;scroll-margin-top:150px}
h2{font-size:13px;line-height:18px;font-weight:600;text-transform:uppercase;
  letter-spacing:.08em;color:var(--muted);margin:0 0 16px;
  padding-bottom:10px;border-bottom:1px solid var(--hairline)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px}

.card{margin:0;border:1px solid var(--hairline);border-radius:12px;
  background:var(--raised);overflow:hidden;display:flex;flex-direction:column}
.stage{padding:24px;display:flex;justify-content:center;align-items:flex-start;
  overflow-x:auto;flex:1}
.stage--light{background:var(--stage-light)}
.stage--dark{background:var(--stage-dark)}
figcaption{border-top:1px solid var(--hairline);padding:10px 14px;
  display:flex;flex-direction:column;gap:3px;background:var(--raised)}
.cap-name{font-size:13px;line-height:18px;font-weight:600}
.cap-meta{display:flex;align-items:center;gap:8px;font-size:11px;line-height:16px;color:var(--faint)}
.cap-meta code{font-size:11px}
.layers::after{content:' 레이어'}
.chip{background:var(--caution-bg);border:1px solid var(--caution-br);color:var(--caution-fg);
  border-radius:999px;padding:1px 7px;font-weight:600;font-size:10px}
.warn{outline:1px dashed var(--caution-fg);outline-offset:1px}

/* 테마 세트 전환 — 뷰어 테마와 독립적으로 어떤 아트보드를 볼지 고른다 */
:root[data-set="light"] .card[data-set="dark"]{display:none}
:root[data-set="dark"] .card[data-set="light"]{display:none}

.note{max-width:64ch;color:var(--muted);font-size:13px;line-height:20px;
  border-left:2px solid var(--hairline);padding-left:14px;margin:0 0 32px}
.note strong{color:var(--ink);font-weight:600}

@media (max-width:820px){
  .wrap{grid-template-columns:1fr;gap:20px;padding:20px 16px 72px}
  nav{position:static}
  nav ul{flex-direction:row;flex-wrap:wrap;gap:6px}
  nav a{background:var(--sunken);padding:6px 12px}
}
</style>

<header>
  <div class="brand">
    <h1>Figma 이식 미리보기</h1>
    <span class="sub">플러그인이 그릴 결과를 IR에서 그대로 재현했습니다</span>
    <div class="switch" role="group" aria-label="아트보드 테마 선택">
      <button type="button" data-set-btn="light" aria-pressed="true">라이트</button>
      <button type="button" data-set-btn="dark" aria-pressed="false">다크</button>
    </div>
  </div>
  <div class="stats">
    <span>아트보드 <b>${doc.artboards.length}</b></span>
    <span>레이어 <b>${totalNodes.toLocaleString('ko-KR')}</b></span>
    <span>그룹 <b>${groups.length}</b></span>
    <span>충실도 경고 <b>${doc.warnings.length}</b></span>
  </div>
</header>

<div class="wrap">
  <nav aria-label="그룹"><ul>${nav}</ul></nav>
  <main>
    <p class="note">각 카드는 <strong>Figma가 만들 Auto Layout 프레임</strong>을 같은 규칙으로 그린 것입니다 —
    스크린샷이 아니라 IR을 렌더한 결과라, 여기서 보이는 간격·정렬·색이 곧 Figma에 생길 값입니다.
    점선이 쳐진 레이어는 충실도가 보장되지 않는 지점(⚠️)이고, 커서를 올리면 사유가 나옵니다.</p>
    ${sections}
  </main>
</div>

<script>
(function(){
  var root=document.documentElement;
  var prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
  function apply(set){
    root.setAttribute('data-set',set);
    document.querySelectorAll('[data-set-btn]').forEach(function(b){
      b.setAttribute('aria-pressed',String(b.getAttribute('data-set-btn')===set));
    });
  }
  apply(prefersDark?'dark':'light');
  document.querySelectorAll('[data-set-btn]').forEach(function(b){
    b.addEventListener('click',function(){apply(b.getAttribute('data-set-btn'));});
  });
})();
</script>
`;

fs.writeFileSync(OUT, html, 'utf8');
console.log(`미리보기 생성 → ${OUT}`);
console.log(`  ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)}MB · 아트보드 ${doc.artboards.length}개 · 레이어 ${totalNodes}`);
