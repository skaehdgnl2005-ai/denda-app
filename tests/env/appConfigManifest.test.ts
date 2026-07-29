// app.config.ts — EAS Update 매니페스트 검증 제약.
//
// 왜 필요한가 (실제로 터진 사고):
//   `android.adaptiveIcon.backgroundColor: '#fff'`(3자리 축약형)로 **네이티브 빌드는 통과**했지만,
//   `eas update` 발행 시 서버 매니페스트 검증이 거부했다:
//     Manifest Validation Error: 'android/adaptiveIcon/backgroundColor' should be
//     a 6 character long hex color string
//   빌드에서 안 걸리고 OTA 배포 시점에만 걸리므로, 급할 때(핫픽스 송출) 발목을 잡는다.
//
// 색 값이 config 어디에 추가되든 잡도록 키 이름으로 재귀 탐색한다.

import appConfig from '../../app.config';

const config = appConfig({ config: {} } as never) as unknown as Record<string, unknown>;

/** 6자리 hex만 허용 (#RGB 축약형·#RRGGBBAA 알파 모두 거부 — EAS 매니페스트 규칙). */
const SIX_DIGIT_HEX = /^#[0-9a-fA-F]{6}$/;

/** config 트리에서 이름에 color가 들어가는 문자열 필드를 전부 수집. */
function collectColorFields(
  node: unknown,
  path: string,
  found: { path: string; value: string }[] = [],
): { path: string; value: string }[] {
  if (Array.isArray(node)) {
    node.forEach((item, i) => collectColorFields(item, `${path}[${i}]`, found));
    return found;
  }
  if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const child = path ? `${path}/${key}` : key;
      if (typeof value === 'string' && /color/i.test(key)) {
        found.push({ path: child, value });
      } else {
        collectColorFields(value, child, found);
      }
    }
  }
  return found;
}

describe('app.config.ts — EAS Update 매니페스트 제약', () => {
  const colors = collectColorFields(config, '');

  it('색 필드를 실제로 찾아낸다 (탐색기가 죽으면 아래 검증이 무의미)', () => {
    expect(colors.length).toBeGreaterThan(0);
    expect(colors.map((c) => c.path)).toContain('android/adaptiveIcon/backgroundColor');
  });

  it('모든 색 값은 6자리 hex — 축약형(#fff)은 eas update가 거부한다', () => {
    const invalid = colors
      .filter(({ value }) => !SIX_DIGIT_HEX.test(value))
      .map(({ path, value }) => `${path} = ${value}`);
    expect(invalid).toEqual([]);
  });
});
