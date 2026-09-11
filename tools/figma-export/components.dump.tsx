// 컴포넌트 카탈로그를 라이트/다크 두 번 렌더해 dump.json으로 내보낸다.
// Jest 테스트 형태인 이유: RN 컴포넌트를 렌더하려면 jest-expo의 변환·네이티브 mock이 필요한데,
// 그걸 그대로 재사용하는 것이 가장 싸다. npm test에는 잡히지 않는다 (jest.figma.config.js 전용).
//
// 실행: npm run figma:dump
import React from 'react';
import { View } from 'react-native';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/design/theme';
import { emitPart } from './emit';
import { fixtures } from './fixtures';
import { fromTestInstance, normalize, type SourceNode } from './normalize';
import type { IRArtboard, IRNode } from './ir';

// expo-router — GroupFab 등이 useRouter를 호출한다.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => ({}),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

// 테마 전환 — ThemeProvider가 useColorScheme을 읽는다.
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const useColorSchemeMock = require('react-native/Libraries/Utilities/useColorScheme')
  .default as jest.Mock;

const INSETS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** 픽스처 루트를 트리에서 정확히 찾기 위한 표식 — 하네스 프레임이 아트보드로 새는 것을 막는다. */
const ROOT_MARKER = 'figma-fixture-root';

function Harness({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <SafeAreaProvider initialMetrics={INSETS}>
      <ThemeProvider>
        <View testID={ROOT_MARKER}>{children}</View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** ROOT_MARKER가 붙은 host 노드를 찾는다. */
function findFixtureRoot(node: SourceNode): SourceNode | null {
  if (node.isHost && node.props.testID === ROOT_MARKER) return node;
  for (const c of node.children) {
    if (typeof c === 'string') continue;
    const found = findFixtureRoot(c);
    if (found) return found;
  }
  return null;
}

describe('figma-export 컴포넌트 덤프', () => {
  it(`픽스처 ${fixtures.length}개를 라이트·다크로 내보낸다`, () => {
    const artboards: IRArtboard[] = [];
    const warnings: string[] = [];

    for (const theme of ['light', 'dark'] as const) {
      useColorSchemeMock.mockReturnValue(theme);

      for (const fixture of fixtures) {
        const r = render(<Harness>{fixture.element}</Harness>);
        const source = fromTestInstance(r.UNSAFE_root);
        const marked = findFixtureRoot(source);
        if (!marked) throw new Error(`${fixture.id}: 픽스처 루트를 찾지 못했습니다.`);

        const result = normalize(marked);
        // 표식 View는 아트보드에 필요 없다 — 자식이 하나면 그것이 곧 픽스처 루트다.
        let root: IRNode = result.root;
        if (root.kind === 'frame' && root.children.length === 1) root = root.children[0] ?? root;
        root.name = fixture.name;

        artboards.push({
          id: `${fixture.id}/${theme}`,
          group: fixture.group,
          name: fixture.name,
          theme,
          frameWidth: fixture.frameWidth ?? null,
          root,
        });
        warnings.push(...result.warnings.map((w) => `[${fixture.id}/${theme}] ${w}`));
        r.unmount();
      }
    }

    emitPart('components', { artboards, warnings });

    expect(artboards).toHaveLength(fixtures.length * 2);
    expect(artboards.every((a) => a.root)).toBe(true);
  });
});
