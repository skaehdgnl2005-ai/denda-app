// IR → Figma 노드. 의도적으로 멍청하게 유지한다 —
// 판단은 전부 normalize.ts에서 끝났고, 여기는 받아쓰기만 한다.
//
// 호출 순서가 중요하다 (plugin-api.d.ts 대조로 확인):
//  1. 노드 생성 → 2. 부모에 appendChild → 3. layoutMode/padding/정렬
//  → 4. layoutSizing (부모가 auto-layout이어야 유효) → 5. 절대 배치는 layoutPositioning 먼저
//
// 빌드: npm run figma:build  (dump.json이 번들에 함께 들어간다)

import DUMP from '../out/dump.json';
import type {
  IRArtboard,
  IRDocument,
  IRFrame,
  IRNode,
  IRPlaceholder,
  IRSizing,
  IRText,
  IRVector,
} from '../ir';

const doc = DUMP as unknown as IRDocument;

const GROUP_GAP = 120;
const ITEM_GAP = 64;
const THEME_LABEL: Record<string, string> = { light: '라이트', dark: '다크' };

/** 폰트 로드에 실패했을 때 최종적으로 기대는 Figma 기본 폰트. */
const LAST_RESORT: FontName = { family: 'Inter', style: 'Regular' };

const loadedFonts = new Map<string, FontName>();
const notes: string[] = [];

function key(family: string, style: string): string {
  return `${family}__${style}`;
}

/**
 * 폰트 preflight — 텍스트 노드를 만들기 전에 한 번만 돈다.
 * loadFontAsync가 reject하면 그 노드 생성 자체가 throw하므로, 실패를 여기서 흡수한다.
 */
async function resolveFont(family: string, candidates: string[]): Promise<FontName> {
  for (const style of candidates) {
    const k = key(family, style);
    const cached = loadedFonts.get(k);
    if (cached) return cached;
    try {
      const font: FontName = { family, style };
      await figma.loadFontAsync(font);
      loadedFonts.set(k, font);
      return font;
    } catch {
      // 다음 후보로.
    }
  }
  const fallbackKey = key(LAST_RESORT.family, LAST_RESORT.style);
  if (!loadedFonts.has(fallbackKey)) {
    await figma.loadFontAsync(LAST_RESORT);
    loadedFonts.set(fallbackKey, LAST_RESORT);
    notes.push(
      `"${family}"를 찾지 못해 ${LAST_RESORT.family}로 대체했습니다. ` +
        `Pretendard Variable을 설치한 뒤 다시 실행하면 정확한 타이포가 나옵니다.`,
    );
  }
  return LAST_RESORT;
}

async function preflightFonts(): Promise<void> {
  const seen = new Set<string>();
  const visit = (n: IRNode): void => {
    if (n.kind === 'text') {
      const sig = `${n.text.fontFamily}|${n.text.fontStyleCandidates.join(',')}`;
      if (!seen.has(sig)) seen.add(sig);
    }
    if (n.kind === 'frame') n.children.forEach(visit);
  };
  doc.artboards.forEach((a) => visit(a.root));

  for (const sig of seen) {
    const [family, styles] = sig.split('|');
    await resolveFont(family ?? '', (styles ?? '').split(','));
  }
}

// --- 노드 빌더 ---------------------------------------------------------------

function displayName(n: IRNode): string {
  return n.warnings && n.warnings.length > 0 ? `⚠️ ${n.name}` : n.name;
}

function applyBox(node: FrameNode, ir: IRFrame | IRPlaceholder): void {
  const b = ir.box;
  node.fills = b.fills as readonly Paint[] as Paint[];
  node.strokes = b.strokes as readonly Paint[] as Paint[];
  if (b.strokeWeight > 0) {
    node.strokeWeight = b.strokeWeight;
    node.strokeAlign = 'INSIDE';
  }
  node.topLeftRadius = b.cornerRadius.tl;
  node.topRightRadius = b.cornerRadius.tr;
  node.bottomRightRadius = b.cornerRadius.br;
  node.bottomLeftRadius = b.cornerRadius.bl;
  node.opacity = b.opacity;
  node.clipsContent = b.clipsContent;
  if (b.effects.length > 0) node.effects = b.effects as unknown as Effect[];
}

function applyAutoLayout(node: FrameNode, ir: IRFrame): void {
  node.layoutMode = ir.layout.mode;
  if (ir.layout.mode === 'NONE') return;

  node.primaryAxisAlignItems = ir.layout.primaryAxisAlignItems;
  node.counterAxisAlignItems = ir.layout.counterAxisAlignItems;
  node.itemSpacing = ir.layout.itemSpacing;
  node.paddingTop = ir.layout.paddingTop;
  node.paddingRight = ir.layout.paddingRight;
  node.paddingBottom = ir.layout.paddingBottom;
  node.paddingLeft = ir.layout.paddingLeft;
  // layoutWrap은 가로 방향에서만 유효하다.
  if (ir.layout.mode === 'HORIZONTAL') {
    node.layoutWrap = ir.layout.wrap ? 'WRAP' : 'NO_WRAP';
  }
}

/** IR의 크기 정책 → Figma layoutSizing. 부모가 auto-layout일 때만 FILL이 유효하다. */
function sizingFor(
  value: IRSizing,
  isMainAxis: boolean,
  ir: IRNode,
  parentIsAutoLayout: boolean,
): 'FIXED' | 'HUG' | 'FILL' {
  if (typeof value === 'number') return 'FIXED';
  if (!parentIsAutoLayout) return 'HUG';
  if (value === 'FILL') return 'FILL';
  if (isMainAxis && ir.layout.grow === 1) return 'FILL';
  if (!isMainAxis && ir.layout.stretchCrossAxis) return 'FILL';
  return 'HUG';
}

function applySizing(
  node: SceneNode & LayoutMixin,
  ir: IRNode,
  parentMode: 'HORIZONTAL' | 'VERTICAL' | 'NONE',
): void {
  const parentIsAutoLayout = parentMode !== 'NONE';
  const w = ir.layout.width;
  const h = ir.layout.height;

  // 고정 크기는 resize로 먼저 확정 (Figma는 0.01 미만을 거부한다).
  const fixedW = typeof w === 'number' ? Math.max(w, 0.01) : null;
  const fixedH = typeof h === 'number' ? Math.max(h, 0.01) : null;
  if (fixedW !== null || fixedH !== null) {
    node.resize(fixedW ?? node.width, fixedH ?? node.height);
  }

  const hMode = sizingFor(w, parentMode === 'HORIZONTAL', ir, parentIsAutoLayout);
  const vMode = sizingFor(h, parentMode === 'VERTICAL', ir, parentIsAutoLayout);
  try {
    node.layoutSizingHorizontal = hMode;
    node.layoutSizingVertical = vMode;
  } catch {
    // HUG는 auto-layout 프레임/텍스트에만 유효하다. 실패해도 치명적이지 않다.
  }
}

function applyAbsolute(node: SceneNode & LayoutMixin & ConstraintMixin, ir: IRNode): void {
  const abs = ir.layout.absolute;
  if (!abs) return;
  // 순서 중요: ABSOLUTE로 바꾸기 전에는 x/y 대입이 무시된다.
  node.layoutPositioning = 'ABSOLUTE';
  node.constraints = { horizontal: abs.horizontal, vertical: abs.vertical };
  if (abs.left !== undefined) node.x = abs.left;
  if (abs.top !== undefined) node.y = abs.top;
}

async function buildText(ir: IRText, parent: BaseNode & ChildrenMixin): Promise<TextNode> {
  const node = figma.createText();
  parent.appendChild(node);

  const font = await resolveFont(ir.text.fontFamily, ir.text.fontStyleCandidates);
  node.fontName = font;
  node.characters = ir.characters;
  node.fontSize = ir.text.fontSize;
  node.name = displayName(ir);

  if (ir.text.lineHeight !== null) {
    node.lineHeight = { value: ir.text.lineHeight, unit: 'PIXELS' };
  }
  node.letterSpacing = { value: ir.text.letterSpacing, unit: 'PIXELS' };
  node.textAlignHorizontal = ir.text.textAlign;
  if (ir.text.fills.length > 0) node.fills = ir.text.fills as unknown as Paint[];

  return node;
}

function buildVector(ir: IRVector, parent: BaseNode & ChildrenMixin): FrameNode {
  const node = figma.createNodeFromSvg(ir.svg);
  parent.appendChild(node);
  node.name = displayName(ir);
  node.fills = [];
  // SVG의 intrinsic 크기가 RN 크기와 다르면 내용까지 비례 축소한다.
  if (node.width > 0 && Math.abs(node.width - ir.width) > 0.5) {
    node.rescale(ir.width / node.width);
  }
  return node;
}

function buildPlaceholder(ir: IRPlaceholder, parent: BaseNode & ChildrenMixin): FrameNode {
  const node = figma.createFrame();
  parent.appendChild(node);
  node.name = `⚠️ ${ir.name} (${ir.reason})`;
  applyBox(node, ir);
  // node.fills는 figma.mixed일 수 있으므로 IR을 진실로 삼는다.
  if (ir.box.fills.length === 0) {
    node.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.96 }, opacity: 1 }];
  }
  node.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.82 }, opacity: 1 }];
  node.strokeWeight = 1;
  node.dashPattern = [4, 4];
  return node;
}

async function buildNode(
  ir: IRNode,
  parent: BaseNode & ChildrenMixin,
  parentMode: 'HORIZONTAL' | 'VERTICAL' | 'NONE',
): Promise<SceneNode> {
  let node: SceneNode;

  if (ir.kind === 'text') {
    node = await buildText(ir, parent);
  } else if (ir.kind === 'vector') {
    node = buildVector(ir, parent);
  } else if (ir.kind === 'placeholder') {
    node = buildPlaceholder(ir, parent);
  } else {
    const frame = figma.createFrame();
    parent.appendChild(frame);
    frame.name = displayName(ir);
    applyAutoLayout(frame, ir);
    applyBox(frame, ir);
    for (const child of ir.children) {
      await buildNode(child, frame, ir.layout.mode);
    }
    node = frame;
  }

  applySizing(node as SceneNode & LayoutMixin, ir, parentMode);
  applyAbsolute(node as SceneNode & LayoutMixin & ConstraintMixin, ir);
  return node;
}

// --- 페이지 배치 --------------------------------------------------------------

async function buildArtboard(a: IRArtboard, page: PageNode): Promise<SceneNode> {
  const node = await buildNode(a.root, page, 'NONE');
  node.name = a.name;
  if (a.frameWidth !== null && 'resize' in node) {
    (node as FrameNode).resize(a.frameWidth, Math.max(node.height, 1));
  }
  return node;
}

async function makeLabel(text: string, size: number, page: PageNode): Promise<TextNode> {
  const t = figma.createText();
  page.appendChild(t);
  const font = await resolveFont('Pretendard Variable', ['Bold', 'SemiBold', 'Regular']);
  t.fontName = font;
  t.characters = text;
  t.fontSize = size;
  return t;
}

async function buildPage(theme: 'light' | 'dark'): Promise<number> {
  const page = figma.createPage();
  page.name = THEME_LABEL[theme] ?? theme;

  const boards = doc.artboards.filter((a) => a.theme === theme);
  const groups: string[] = [];
  for (const b of boards) if (!groups.includes(b.group)) groups.push(b.group);

  let cursorX = 0;
  for (const group of groups) {
    const label = await makeLabel(group, 24, page);
    label.x = cursorX;
    label.y = -64;

    let cursorY = 0;
    let widest = 0;
    for (const board of boards.filter((b) => b.group === group)) {
      const node = await buildArtboard(board, page);
      node.x = cursorX;
      node.y = cursorY;
      cursorY += node.height + ITEM_GAP;
      widest = Math.max(widest, node.width);
    }
    cursorX += widest + GROUP_GAP;
  }
  return boards.length;
}

async function main(): Promise<void> {
  await figma.loadAllPagesAsync();
  await preflightFonts();

  let total = 0;
  for (const theme of ['light', 'dark'] as const) {
    total += await buildPage(theme);
  }

  const summary =
    `아트보드 ${total}개를 만들었습니다.` +
    (doc.warnings.length > 0 ? ` 충실도 경고 ${doc.warnings.length}건 (⚠️ 레이어 확인).` : '') +
    (notes.length > 0 ? ` ${notes[0]}` : '');

  figma.notify(summary, { timeout: 8000 });
  figma.closePlugin(summary);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  figma.closePlugin(`이식 중 오류: ${message}`);
});
