// 모임(그룹) 라우트 화면을 Figma 아트보드로 내보낸다.
//
// mock 세트는 tests/screens/group/*.test.tsx에서 이미 통과가 검증된 블록을 그대로 복제했다
// (new · confirm · invite · place · place-search). jest.mock은 모듈 스코프라 화면 그룹마다
// 파일 하나 — 파트(emitPart)로 합쳐진다.
//
// 실행: npx jest --config jest.figma.config.js --testPathPattern screens.group
import React from 'react';
import { View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DateTime } from 'luxon';

import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';
import type { CellState } from '@/lib/heatmap/types';
import { emitPart } from './emit';
import { fromTestInstance, normalize, type SourceNode } from './normalize';
import type { IRArtboard, IRNode } from './ir';

const KST = 'Asia/Seoul';
const today = DateTime.now().setZone(KST);
/** 후보 날짜 3일 (오늘 기준 미래 — 그리드 헤더가 항상 유효한 KST 날짜를 그린다). */
const GROUP_DATES = [1, 2, 3].map((d) => today.plus({ days: d }).toISODate() ?? '');

function kstUtcIso(dateIso: string, hour: number): string {
  return DateTime.fromISO(dateIso, { zone: KST }).set({ hour }).toUTC().toISO() ?? '';
}

const HOST_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const GROUP_ID = '11111111-2222-3333-4444-555555555555';
const PLACE_ID = 'cccccccc-dddd-eeee-ffff-000000000000';
const PARTNERSHIP_ID = '99999999-8888-7777-6666-555555555555';

// ── mock (tests/screens/group/*.test.tsx 복제) ────────────────────────────────

let mockParams: Record<string, string> = { id: GROUP_ID };
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require('react');
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (cb: () => void) => ReactMod.useEffect(() => cb(), [cb]),
  };
});

let mockUserId: string | null = HOST_ID;
jest.mock('@/lib/auth/setup', () => ({
  useAuth: <T,>(selector: (s: { session: { user: { id: string } } | null }) => T): T =>
    selector(mockUserId ? { session: { user: { id: mockUserId } } } : { session: null }),
}));

// group/[id]/index.tsx (모임 상세)
const mockFetchGroup = jest.fn();
const mockFetchUserVotes = jest.fn();
jest.mock('@/lib/groups/queries', () => ({
  fetchGroupForConfirm: (...args: unknown[]) => mockFetchGroup(...args),
  fetchUserVotes: (...args: unknown[]) => mockFetchUserVotes(...args),
}));
jest.mock('@/lib/groups/confirm', () => ({
  confirmGroup: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/votes/api', () => ({
  commitVoteDiff: jest.fn().mockResolvedValue(undefined),
}));

let mockCells: CellState[][] = [];
jest.mock('@/lib/heatmap/useHeatmapSubscription', () => ({
  useHeatmapSubscription: () => ({
    cells: mockCells,
    isConnected: true,
    status: 'connected',
  }),
}));

// gesture-handler 의존 회피 — SelectionOverlay가 구독하는 shared value도 함께 노출.
jest.mock('@/lib/votes/useSweepGesture', () => ({
  useSweepGesture: () => ({
    panGesture: { _handlers: {} },
    selection: { value: {} },
    scrollOffsetY: { value: 0 },
    startCoord: { value: null },
    currentCoord: { value: null },
    toggleAdd: { value: true },
  }),
}));

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated/mock');
  return {
    ...actual,
    useSharedValue: (v: unknown) => ({ value: v }),
  };
});

// group/new.tsx — KST 오늘을 고정해 캘린더를 결정적으로 만든다 (2026-03 미래 셀 다수).
const mockCreateGroup = jest.fn();
jest.mock('@/lib/groups/create', () => ({
  createGroup: (...args: unknown[]) => mockCreateGroup(...args),
}));
jest.mock('@/lib/groups/dateOptions', () => ({
  ...jest.requireActual('@/lib/groups/dateOptions'),
  todayKstIso: (): string => '2026-03-10',
}));

// group/[id]/invite.tsx
const mockListFriends = jest.fn();
jest.mock('@/lib/friends/api', () => ({
  friendsApi: {
    list: (...args: unknown[]) => mockListFriends(...args),
  },
}));
jest.mock('@/lib/groups/invitations', () => ({
  invitationsApi: {
    createInvitation: jest.fn().mockResolvedValue(undefined),
  },
}));

// group/[id]/place.tsx
const mockFetchPlace = jest.fn();
jest.mock('@/lib/places/queries', () => ({
  fetchPlace: (...args: unknown[]) => mockFetchPlace(...args),
}));
jest.mock('@/lib/analytics/click_through', () => ({
  logReservationClick: jest.fn().mockResolvedValue({ ok: true, eventId: 'evt', duplicated: false }),
}));
jest.mock('@/lib/share/kakaoShare', () => ({
  sharePlaceToKakao: jest.fn().mockResolvedValue({ shared: true }),
  createNativeShareApi: () => ({ share: jest.fn() }),
}));

// group/[id]/place-search.tsx
interface SearchState {
  query: string;
  setQuery: (q: string) => void;
  results: PlaceResult[];
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}
interface PlaceResult {
  providerPlaceId: string;
  name: string;
  category: string | null;
  address: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  source: 'naver';
}
let mockSearchState: SearchState = {
  query: '',
  setQuery: jest.fn(),
  results: [],
  isLoading: false,
  error: null,
  retry: jest.fn(),
};
jest.mock('@/lib/places/useMapSearch', () => ({
  useMapSearch: () => mockSearchState,
}));
jest.mock('@/lib/places/persist', () => ({
  persistPlace: jest.fn().mockResolvedValue('place-uuid'),
}));
jest.mock('@/lib/groups/setConfirmedPlace', () => ({
  setConfirmedPlace: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/places/partnership', () => ({
  isResultPartner: () => false,
}));
// 네이티브 지도는 덤프에서 항상 비활성 → MapHost가 fallback(리스트)만 그린다 (D38).
jest.mock('@/lib/map/mapAvailability', () => ({
  isMapAvailable: () => false,
}));

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const useColorSchemeMock = require('react-native/Libraries/Utilities/useColorScheme')
  .default as jest.Mock;

// mock 등록 이후에 import해야 한다.
/* eslint-disable @typescript-eslint/no-require-imports */
const NewGroupScreen = require('../../app/group/new').default as React.ComponentType;
const GroupDetailScreen = require('../../app/group/[id]/index').default as React.ComponentType;
const GroupInviteScreen = require('../../app/group/[id]/invite').default as React.ComponentType;
const GroupPlaceScreen = require('../../app/group/[id]/place').default as React.ComponentType;
const PlaceSearchScreen = require('../../app/group/[id]/place-search')
  .default as React.ComponentType;
/* eslint-enable @typescript-eslint/no-require-imports */

// ── 하네스 ────────────────────────────────────────────────────────────────────

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

// ── 데이터 fixture ────────────────────────────────────────────────────────────

const ROW_COUNT = 60; // 09:00~23:45, 15분 단위
const MEMBER_COUNT = 5;

/** heat-0~4 + self가 한 화면에 모두 보이는 저녁 편중 히트맵 (D10 5-stop ramp 검수용). */
function makeHeatCells(dayCount: number): CellState[][] {
  const inRange = (row: number, from: number, to: number): boolean => row >= from && row < to;
  return Array.from({ length: ROW_COUNT }, (_, row) =>
    Array.from({ length: dayCount }, (_, col): CellState => {
      if (col === 0 && inRange(row, 28, 36)) return { state: 'heat-2', count: 2 };
      if (col === 0 && inRange(row, 40, 46)) return { state: 'self', count: 3 };
      if (col === 1 && inRange(row, 30, 36)) return { state: 'heat-3', count: 4 };
      if (col === 1 && inRange(row, 36, 48)) return { state: 'heat-4', count: 5 };
      if (col === 2 && inRange(row, 20, 26)) return { state: 'heat-1', count: 1 };
      return { state: 'heat-0', count: 0 };
    }),
  );
}

const emptyCells = (dayCount: number): CellState[][] =>
  Array.from({ length: ROW_COUNT }, () =>
    Array.from({ length: dayCount }, (): CellState => ({ state: 'heat-0', count: 0 })),
  );

const unconfirmedGroup = {
  id: GROUP_ID,
  hostId: HOST_ID,
  name: '동아리 회식',
  dates: GROUP_DATES,
  memberCount: MEMBER_COUNT,
  confirmedAt: null,
  confirmedStartAt: null,
  confirmedEndAt: null,
  confirmedPlaceId: null,
};

const confirmedGroup = {
  ...unconfirmedGroup,
  confirmedAt: kstUtcIso(GROUP_DATES[0] ?? '', 12),
  confirmedStartAt: kstUtcIso(GROUP_DATES[1] ?? '', 19),
  confirmedEndAt: kstUtcIso(GROUP_DATES[1] ?? '', 22),
};

const friends = [
  { id: 'u-a', nickname: '홍길동' },
  { id: 'u-b', nickname: '김영희' },
  { id: 'u-c', nickname: '이몽룡' },
];

const searchResults: PlaceResult[] = [
  {
    providerPlaceId: 'naver:한솥도시락 안암점:37.123:127.456',
    name: '한솥도시락 안암점',
    category: '한식',
    address: '서울 성북구 안암동 5가 104-1',
    lat: 37.123,
    lng: 127.456,
    phone: null,
    source: 'naver',
  },
  {
    providerPlaceId: 'naver:안암 김치찌개:37.124:127.457',
    name: '안암 김치찌개',
    category: '한식 · 찌개',
    address: '서울 성북구 개운사길 12',
    lat: 37.124,
    lng: 127.457,
    phone: null,
    source: 'naver',
  },
  {
    providerPlaceId: 'naver:고대앞 이자카야:37.125:127.458',
    name: '고대앞 이자카야',
    category: '술집',
    address: '서울 성북구 고려대로 24길 8',
    lat: 37.125,
    lng: 127.458,
    phone: null,
    source: 'naver',
  },
];

/** 모든 fixture 앞에서 공통 기본값으로 되돌린다 (mock 누수 차단). */
function resetMocks(): void {
  mockParams = { id: GROUP_ID };
  mockUserId = HOST_ID;
  mockCells = emptyCells(GROUP_DATES.length);
  mockFetchGroup.mockReset().mockResolvedValue(unconfirmedGroup);
  mockFetchUserVotes.mockReset().mockResolvedValue([]);
  mockCreateGroup.mockReset().mockResolvedValue({ id: 'g-123' });
  mockListFriends.mockReset().mockResolvedValue(friends);
  mockFetchPlace.mockReset().mockResolvedValue({
    id: PLACE_ID,
    name: '한솥도시락 안암점',
    category: '한식',
    address: '서울 성북구 안암동 5가 104-1',
    partnershipId: PARTNERSHIP_ID,
  });
  mockSearchState = {
    query: '',
    setQuery: jest.fn(),
    results: [],
    isLoading: false,
    error: null,
    retry: jest.fn(),
  };
}

type RenderResult = ReturnType<typeof render>;

interface ScreenFixture {
  id: string;
  name: string;
  element: React.ReactElement;
  /** 렌더 직전 데이터 mock 설정 */
  setup: () => void;
  /** 렌더 이후 상태 전이 (선택 · 입력 등) */
  interact?: (r: RenderResult) => void;
}

const screens: ScreenFixture[] = [
  {
    id: 'screen/group-new',
    name: '새 모임 · 기본',
    element: <NewGroupScreen />,
    setup: () => {},
  },
  {
    id: 'screen/group-new-filled',
    name: '새 모임 · 날짜 선택됨',
    element: <NewGroupScreen />,
    setup: () => {},
    interact: (r) => {
      fireEvent.changeText(r.getByTestId('group-name-input'), '5월 30일 저녁 모임');
      fireEvent.press(r.getByTestId('calendar-day-2026-03-12'));
      fireEvent.press(r.getByTestId('calendar-day-2026-03-13'));
      fireEvent.press(r.getByTestId('calendar-day-2026-03-14'));
    },
  },
  {
    id: 'screen/group-detail-loading',
    name: '모임 상세 · 로딩',
    element: <GroupDetailScreen />,
    setup: () => {
      // 영원히 pending — 스켈레톤 상태를 그대로 잡는다.
      mockFetchGroup.mockReset().mockImplementation(() => new Promise(() => {}));
    },
  },
  {
    id: 'screen/group-detail-voting',
    name: '모임 상세 · 투표 중',
    element: <GroupDetailScreen />,
    setup: () => {
      mockCells = makeHeatCells(GROUP_DATES.length);
      mockFetchUserVotes.mockReset().mockResolvedValue([
        { day: GROUP_DATES[0] ?? '', start_minute: 1140 },
        { day: GROUP_DATES[0] ?? '', start_minute: 1155 },
      ]);
    },
  },
  {
    id: 'screen/group-detail-confirm-sheet',
    name: '모임 상세 · 시간 추천 시트',
    element: <GroupDetailScreen />,
    setup: () => {
      mockCells = makeHeatCells(GROUP_DATES.length);
    },
    interact: (r) => {
      fireEvent.press(r.getByTestId('host-confirm-button'));
    },
  },
  {
    id: 'screen/group-detail-confirmed',
    name: '모임 상세 · 확정',
    element: <GroupDetailScreen />,
    setup: () => {
      mockCells = makeHeatCells(GROUP_DATES.length);
      mockFetchGroup.mockReset().mockResolvedValue(confirmedGroup);
    },
  },
  {
    id: 'screen/group-invite',
    name: '친구 초대 · 선택',
    element: <GroupInviteScreen />,
    setup: () => {},
    interact: (r) => {
      fireEvent.press(r.getByTestId('invite-friend-u-a'));
      fireEvent.press(r.getByTestId('invite-friend-u-b'));
    },
  },
  {
    id: 'screen/group-invite-empty',
    name: '친구 초대 · 빈 상태',
    element: <GroupInviteScreen />,
    setup: () => {
      mockListFriends.mockReset().mockResolvedValue([]);
    },
  },
  {
    id: 'screen/group-place-search',
    name: '장소 검색 · 결과',
    element: <PlaceSearchScreen />,
    setup: () => {
      mockSearchState = { ...mockSearchState, query: '안암', results: searchResults };
    },
  },
  {
    id: 'screen/group-place-search-empty',
    name: '장소 검색 · 결과 없음',
    element: <PlaceSearchScreen />,
    setup: () => {
      mockSearchState = { ...mockSearchState, query: '없는검색어', results: [] };
    },
  },
  {
    id: 'screen/group-place',
    name: '장소 액션 시트 · 제휴',
    element: <GroupPlaceScreen />,
    setup: () => {
      mockParams = { id: GROUP_ID, placeId: PLACE_ID };
      mockFetchGroup.mockReset().mockResolvedValue(confirmedGroup);
    },
  },
];

describe('figma-export 모임 화면 덤프', () => {
  it(`화면 ${screens.length}개를 라이트·다크로 내보낸다`, async () => {
    const artboards: IRArtboard[] = [];
    const warnings: string[] = [];

    for (const theme of ['light', 'dark'] as const) {
      useColorSchemeMock.mockReturnValue(theme);

      for (const screen of screens) {
        resetMocks();
        screen.setup();

        const r = render(<Harness>{screen.element}</Harness>);
        await act(async () => {});
        if (screen.interact) {
          await act(async () => {
            screen.interact?.(r);
          });
        }

        const marked = findRoot(fromTestInstance(r.UNSAFE_root));
        if (!marked) throw new Error(`${screen.id}: 화면 루트를 찾지 못했습니다.`);

        const result = normalize(marked);
        let root: IRNode = result.root;
        if (root.kind === 'frame' && root.children.length === 1) root = root.children[0] ?? root;
        root.name = screen.name;

        artboards.push({
          id: `${screen.id}/${theme}`,
          group: '모임 화면',
          name: screen.name,
          theme,
          frameWidth: SCREEN_WIDTH,
          root,
        });
        warnings.push(...result.warnings.map((w) => `[${screen.id}/${theme}] ${w}`));
        r.unmount();
      }
    }

    emitPart('screens-group', { artboards, warnings });

    expect(artboards).toHaveLength(screens.length * 2);
  });
});
