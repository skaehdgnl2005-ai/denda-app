// 실제 라우트 화면을 Figma 아트보드로 내보낸다.
// mock 세트는 tests/screens/*.test.tsx에서 이미 통과가 검증된 것을 그대로 복제한다 —
// 화면을 추가할 때도 같은 방식이면 된다 (해당 화면 테스트의 jest.mock 블록을 옮겨오기).
//
// 실행: npm run figma:dump
import React from 'react';
import { View } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DateTime } from 'luxon';

import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';
import { emitPart } from './emit';
import { fromTestInstance, normalize, type SourceNode } from './normalize';
import type { IRArtboard, IRNode } from './ir';

const KST = 'Asia/Seoul';
const today = DateTime.now().setZone(KST);
const inMonthIso = today.set({ day: today.day >= 15 ? 5 : 20 }).toISODate() ?? '';

function kstUtcIso(dateIso: string, hour: number): string {
  return DateTime.fromISO(dateIso, { zone: KST }).set({ hour }).toUTC().toISO() ?? '';
}

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require('react');
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useFocusEffect: (cb: () => void) => ReactMod.useEffect(() => cb(), [cb]),
    useLocalSearchParams: () => ({}),
  };
});

jest.mock('@/lib/auth/setup', () => ({
  useAuth: (sel: (s: unknown) => unknown) =>
    sel({ session: { user: { id: 'u1', nickname: '민지' } } }),
}));

const mockFetchMyGroups = jest.fn();
jest.mock('@/lib/groups/list', () => ({
  fetchMyGroups: () => mockFetchMyGroups(),
}));

const mockFetchSchedules = jest.fn();
jest.mock('@/lib/schedules/queries', () => ({
  fetchActiveSchedules: (userId: string) => mockFetchSchedules(userId),
}));

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const useColorSchemeMock = require('react-native/Libraries/Utilities/useColorScheme')
  .default as jest.Mock;

// mock 등록 이후에 import해야 한다.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const HomeScreen = require('../../app/(tabs)/index').default as React.ComponentType;

const SCREEN_WIDTH = 390;
const INSETS = {
  frame: { x: 0, y: 0, width: SCREEN_WIDTH, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const ROOT_MARKER = 'figma-fixture-root';

function Harness({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <SafeAreaProvider initialMetrics={INSETS}>
      <ThemeProvider>
        <ToastProvider>
          <View testID={ROOT_MARKER} style={{ width: SCREEN_WIDTH }}>
            {children}
          </View>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function findRoot(node: SourceNode): SourceNode | null {
  if (node.isHost && node.props.testID === ROOT_MARKER) return node;
  for (const c of node.children) {
    if (typeof c === 'string') continue;
    const found = findRoot(c);
    if (found) return found;
  }
  return null;
}

interface ScreenFixture {
  id: string;
  name: string;
  element: React.ReactElement;
  /** 렌더 직전 데이터 mock 설정 */
  setup: () => void;
}

const screens: ScreenFixture[] = [
  {
    id: 'screen/home-empty',
    name: '홈 · 빈 상태',
    element: <HomeScreen />,
    setup: () => {
      mockFetchMyGroups.mockReset().mockResolvedValue([]);
      mockFetchSchedules.mockReset().mockResolvedValue([]);
    },
  },
  {
    id: 'screen/home-with-group',
    name: '홈 · 확정 모임',
    element: <HomeScreen />,
    setup: () => {
      mockFetchMyGroups.mockReset().mockResolvedValue([
        {
          id: 'g1',
          name: '동아리 회식',
          dates: [inMonthIso],
          confirmedAt: kstUtcIso(inMonthIso, 12),
          confirmedStartAt: kstUtcIso(inMonthIso, 19),
          confirmedEndAt: kstUtcIso(inMonthIso, 22),
          placeName: '강남 이자카야',
        },
      ]);
      mockFetchSchedules.mockReset().mockResolvedValue([]);
    },
  },
];

describe('figma-export 화면 덤프', () => {
  it(`화면 ${screens.length}개를 라이트·다크로 내보낸다`, async () => {
    const artboards: IRArtboard[] = [];
    const warnings: string[] = [];

    for (const theme of ['light', 'dark'] as const) {
      useColorSchemeMock.mockReturnValue(theme);

      for (const screen of screens) {
        screen.setup();
        const r = render(<Harness>{screen.element}</Harness>);
        await act(async () => {});

        const marked = findRoot(fromTestInstance(r.UNSAFE_root));
        if (!marked) throw new Error(`${screen.id}: 화면 루트를 찾지 못했습니다.`);

        const result = normalize(marked);
        let root: IRNode = result.root;
        if (root.kind === 'frame' && root.children.length === 1) root = root.children[0] ?? root;
        root.name = screen.name;

        artboards.push({
          id: `${screen.id}/${theme}`,
          group: '홈 화면',
          name: screen.name,
          theme,
          frameWidth: SCREEN_WIDTH,
          root,
        });
        warnings.push(...result.warnings.map((w) => `[${screen.id}/${theme}] ${w}`));
        r.unmount();
      }
    }

    emitPart('screens-home', { artboards, warnings });

    expect(artboards).toHaveLength(screens.length * 2);
  });
});
