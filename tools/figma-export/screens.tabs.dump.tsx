// 탭 화면(지도·프로필)을 Figma 아트보드로 내보낸다.
// mock 세트는 tests/screens/tabs/map.test.tsx · profile.test.tsx에서 이미 통과가 검증된 것을
// 그대로 복제한다. jest.mock은 모듈 스코프라 화면 그룹마다 파일을 나눈다 (screens.home.dump.tsx 참고).
//
// 실행: npx jest --config jest.figma.config.js --testPathPattern screens.tabs
import React from 'react';
import { View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';
import type { PlaceSearchResult } from '@/lib/places/PlaceSearchProvider';
import type { UseMapSearchState } from '@/lib/places/useMapSearch';
import { emitPart } from './emit';
import { fromTestInstance, normalize, type SourceNode } from './normalize';
import type { IRArtboard, IRNode } from './ir';

// --- 지도 탭 mock (tests/screens/tabs/map.test.tsx 복제) ---------------------
const mockSetQuery = jest.fn();
const mockRetry = jest.fn();
let mockState: UseMapSearchState;

jest.mock('@/lib/places/useMapSearch', () => ({
  useMapSearch: () => mockState,
}));

const mockSharePlace = jest.fn();
jest.mock('@/lib/share/kakaoShare', () => ({
  sharePlaceToKakao: (...args: unknown[]) => mockSharePlace(...args),
  createNativeShareApi: () => ({ share: jest.fn() }),
}));

// --- 프로필 탭 mock (tests/screens/tabs/profile.test.tsx 복제) ---------------
// expo-router는 두 화면이 공유하므로 profile의 `router` + home 러너의 hook API를 합집합으로 둔다.
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useFocusEffect: (cb: () => void) => ReactMod.useEffect(() => cb(), [cb]),
    useLocalSearchParams: () => ({}),
  };
});

const mockSignOut = jest.fn().mockResolvedValue(undefined);
const mockResetForDeletion = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/auth/setup', () => ({
  useAuth: <T,>(selector: (s: { session: { user: { id: string; nickname: string } } }) => T) =>
    selector({ session: { user: { id: 'user-1', nickname: '민지' } } }),
  authStore: {
    getState: () => ({
      signOut: () => mockSignOut(),
      resetForAccountDeletion: () => mockResetForDeletion(),
    }),
  },
}));

const mockDeleteAccount = jest.fn();
jest.mock('@/lib/auth/deleteAccount', () => ({
  deleteAccount: () => mockDeleteAccount(),
}));

// S06 reauth helper — 픽스처마다 끊김 여부를 갈아끼운다.
const mockIsGoogleReauthNeeded = jest.fn().mockResolvedValue(false);
jest.mock('@/lib/calendar/reauth', () => ({
  isGoogleReauthNeeded: (...args: unknown[]) => mockIsGoogleReauthNeeded(...args),
}));

const mockClearGoogleToken = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/calendar/setup', () => ({
  createGoogleCalendarProvider: jest.fn(),
  signInGoogleAndUpload: jest.fn(),
  clearStoredGoogleToken: () => mockClearGoogleToken(),
}));

jest.mock('@/lib/supabase/client', () => ({
  supabase: { rpc: jest.fn().mockResolvedValue({ data: null, error: null }) },
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
const MapScreen = require('../../app/(tabs)/map').default as React.ComponentType;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ProfileScreen = require('../../app/(tabs)/profile').default as React.ComponentType;

const SCREEN_WIDTH = 390;
const INSETS = {
  frame: { x: 0, y: 0, width: SCREEN_WIDTH, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const ROOT_MARKER = 'figma-fixture-root';

function place(name: string, category: string, address: string): PlaceSearchResult {
  return {
    providerPlaceId: `naver:${name}`,
    name,
    category,
    address,
    lat: 37.5,
    lng: 127.0,
    phone: null,
    source: 'naver',
  };
}

/** 지도 화면의 useMapSearch 반환값을 픽스처 단위로 갈아끼운다. */
function setMapState(over: Partial<UseMapSearchState>): void {
  mockState = {
    query: '',
    setQuery: mockSetQuery,
    results: [],
    isLoading: false,
    error: null,
    retry: mockRetry,
    ...over,
  };
}

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

type RenderResult = ReturnType<typeof render>;

interface ScreenFixture {
  id: string;
  name: string;
  element: React.ReactElement;
  /** 렌더 직전 데이터 mock 설정 */
  setup: () => void;
  /** 렌더 이후 상태 전이 (모달 닫기 등). 캡처 전에 실행된다. */
  after?: (r: RenderResult) => Promise<void>;
}

const screens: ScreenFixture[] = [
  {
    id: 'screen/map-initial',
    name: '지도 · 초기 안내',
    element: <MapScreen />,
    setup: () => {
      setMapState({ query: '' });
    },
  },
  {
    id: 'screen/map-results',
    name: '지도 · 검색 결과',
    element: <MapScreen />,
    setup: () => {
      setMapState({
        query: '강남',
        results: [
          place('스타벅스 강남대로점', '카페', '서울 강남구 강남대로 390'),
          place('한신포차 강남점', '한식 > 술집', '서울 강남구 테헤란로 123'),
          place('강남 이자카야', '일식 > 이자카야', '서울 강남구 역삼동 45-3'),
        ],
      });
    },
  },
  {
    id: 'screen/map-error',
    name: '지도 · 검색 실패',
    element: <MapScreen />,
    setup: () => {
      setMapState({
        query: '강남',
        error: '연결이 불안정해요. 잠시 후 다시 시도해주세요.',
        results: [],
      });
    },
  },
  {
    id: 'screen/profile-default',
    name: '프로필 · 기본',
    element: <ProfileScreen />,
    setup: () => {
      mockIsGoogleReauthNeeded.mockReset().mockResolvedValue(false);
    },
  },
  {
    id: 'screen/profile-calendar-disconnected',
    name: '프로필 · 캘린더 연결 끊김',
    element: <ProfileScreen />,
    setup: () => {
      mockIsGoogleReauthNeeded.mockReset().mockResolvedValue(true);
    },
    // 마운트 시 재인증 모달이 자동으로 열린다. "나중에"로 닫아 상시 노출되는
    // '연결 끊김' 행이 보이는 상태를 캡처한다 (모달은 별도 컴포넌트 덤프 소관).
    after: async (r) => {
      await act(async () => {
        fireEvent.press(r.getByTestId('reauth-later-button'));
      });
    },
  },
];

describe('figma-export 탭 화면 덤프', () => {
  it(`화면 ${screens.length}개를 라이트·다크로 내보낸다`, async () => {
    const artboards: IRArtboard[] = [];
    const warnings: string[] = [];

    for (const theme of ['light', 'dark'] as const) {
      useColorSchemeMock.mockReturnValue(theme);

      for (const screen of screens) {
        screen.setup();
        const r = render(<Harness>{screen.element}</Harness>);
        await act(async () => {});
        if (screen.after) await screen.after(r);

        const marked = findRoot(fromTestInstance(r.UNSAFE_root));
        if (!marked) throw new Error(`${screen.id}: 화면 루트를 찾지 못했습니다.`);

        const result = normalize(marked);
        let root: IRNode = result.root;
        if (root.kind === 'frame' && root.children.length === 1) root = root.children[0] ?? root;
        root.name = screen.name;

        artboards.push({
          id: `${screen.id}/${theme}`,
          group: '탭 화면',
          name: screen.name,
          theme,
          frameWidth: SCREEN_WIDTH,
          root,
        });
        warnings.push(...result.warnings.map((w) => `[${screen.id}/${theme}] ${w}`));
        r.unmount();
      }
    }

    emitPart('screens-tabs', { artboards, warnings });

    expect(artboards).toHaveLength(screens.length * 2);
  });
});
