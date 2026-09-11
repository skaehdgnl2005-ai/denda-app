// 친구 그룹 화면(친구 목록 · 요청함 · 친구 검색)을 Figma 아트보드로 내보낸다.
// mock 세트는 tests/screens/friends/*.test.tsx에서 이미 통과가 검증된 것을 그대로 복제한다 —
// 세 화면이 한 파일이므로 mock은 합집합으로 두고, 데이터는 화면별 setup()에서 spy로 갈아끼운다.
//
// 실행: npm run figma:dump
import React from 'react';
import { View } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DateTime } from 'luxon';

import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';
import { friendsApi, type FriendRequest, type FriendUser } from '@/lib/friends/api';
import { invitationsApi, type GroupInvitation } from '@/lib/groups/invitations';
import { emitPart } from './emit';
import { fromTestInstance, normalize, type SourceNode } from './normalize';
import type { IRArtboard, IRNode } from './ir';

const KST = 'Asia/Seoul';
const now = DateTime.now().setZone(KST);

/** KST 기준 N분 전을 UTC ISO로 (D13 — 저장은 UTC, 표시는 KST). */
function minutesAgoUtcIso(minutes: number): string {
  return now.minus({ minutes }).toUTC().toISO() ?? '';
}

jest.mock('expo-router', () => ({
  // 세 화면이 push(index·requests) / back(requests·search)을 쓴다 — 합쳐서 하나로.
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

// friends/index가 useAuth import → setup.ts → @react-native-kakao/user ESM 체인 회피.
jest.mock('@/lib/auth/setup', () => ({
  useAuth: (sel: (s: unknown) => unknown) =>
    sel({ session: { user: { id: 'u1', nickname: '민지' } } }),
}));

// friendsApi / invitationsApi / submitReport가 supabase client를 import → env 변수 throw 회피.
// 실제 데이터는 아래 spy가 가로채므로 client는 껍데기로 충분하다.
jest.mock('@/lib/supabase/client', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

// 카톡 초대는 native Share를 타므로 훅째 대체 (search.test.tsx와 동일).
const mockKakaoInvite = jest.fn();
jest.mock('@/lib/share/useKakaoInvite', () => ({
  useKakaoInvite: () => mockKakaoInvite,
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
const FriendsIndexScreen = require('../../app/(tabs)/friends/index').default as React.ComponentType;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FriendsRequestsScreen = require('../../app/(tabs)/friends/requests')
  .default as React.ComponentType;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FriendsSearchScreen = require('../../app/(tabs)/friends/search')
  .default as React.ComponentType;

const SCREEN_WIDTH = 390;
const INSETS = {
  frame: { x: 0, y: 0, width: SCREEN_WIDTH, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const ROOT_MARKER = 'figma-fixture-root';

// 데이터 — 테스트 픽스처와 같은 인물/모임. 시각만 상대 표기가 살도록 KST 기준 최근으로.
const FRIENDS: FriendUser[] = [
  { id: 'user-2', nickname: '홍길동' },
  { id: 'user-3', nickname: '김영희' },
  { id: 'user-4', nickname: '이철수' },
];

const INCOMING: FriendRequest[] = [
  {
    id: 'req-1',
    sender_id: 'user-5',
    receiver_id: 'me',
    sender: { id: 'user-5', nickname: '박민수' },
    created_at: minutesAgoUtcIso(35),
  },
  {
    id: 'req-2',
    sender_id: 'user-6',
    receiver_id: 'me',
    sender: { id: 'user-6', nickname: '최수지' },
    created_at: minutesAgoUtcIso(190),
  },
];

const OUTGOING: FriendRequest[] = [
  {
    id: 'req-3',
    sender_id: 'me',
    receiver_id: 'user-7',
    receiver: { id: 'user-7', nickname: '정다은' },
    created_at: minutesAgoUtcIso(1500),
  },
];

const INVITATIONS: GroupInvitation[] = [
  {
    id: 'inv-1',
    group_id: 'g-1',
    inviter_id: 'user-8',
    invitee_id: 'me',
    status: 'pending',
    created_at: minutesAgoUtcIso(60),
    group: { id: 'g-1', name: '점심 모임' },
    inviter: { id: 'user-8', nickname: '강하나' },
  },
  {
    id: 'inv-2',
    group_id: 'g-2',
    inviter_id: 'user-9',
    invitee_id: 'me',
    status: 'pending',
    created_at: minutesAgoUtcIso(420),
    group: { id: 'g-2', name: '저녁 모임' },
    inviter: { id: 'user-9', nickname: '윤지호' },
  },
];

const SEARCH_RESULTS: FriendUser[] = [
  { id: 'user-10', nickname: '김하늘' },
  { id: 'user-11', nickname: '김도윤' },
];

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

/**
 * 요청함 탭 인디케이터(W3-5)는 onLayout으로 폭을 잰 뒤에야 렌더된다.
 * 테스트 환경엔 레이아웃 이벤트가 없으므로 직접 주입하고 슬라이드 애니메이션이 끝날 때까지 기다린다.
 */
async function settleTabIndicator(r: RenderResult): Promise<void> {
  await act(async () => {
    fireEvent(r.getByTestId('requests-tabbar'), 'layout', {
      nativeEvent: { layout: { width: SCREEN_WIDTH, height: 44, x: 0, y: 0 } },
    });
  });
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 400);
    });
  });
}

interface ScreenFixture {
  id: string;
  name: string;
  element: React.ReactElement;
  /** 렌더 직전 데이터 mock 설정 */
  setup: () => void;
  /** 렌더 후 상태 전환 (탭 이동·검색어 입력 등) */
  interact?: (r: RenderResult) => Promise<void>;
}

const screens: ScreenFixture[] = [
  {
    id: 'screen/friends-list',
    name: '친구 목록 · 친구 있음',
    element: <FriendsIndexScreen />,
    setup: () => {
      jest.spyOn(friendsApi, 'list').mockResolvedValue([...FRIENDS]);
      jest.spyOn(friendsApi, 'listIncomingRequests').mockResolvedValue([...INCOMING]);
      jest.spyOn(invitationsApi, 'listMyInvitations').mockResolvedValue([...INVITATIONS]);
    },
    interact: async (r) => {
      await waitFor(() => expect(r.getByText('홍길동')).toBeTruthy());
    },
  },
  {
    id: 'screen/friends-empty',
    name: '친구 목록 · 빈 상태',
    element: <FriendsIndexScreen />,
    setup: () => {
      jest.spyOn(friendsApi, 'list').mockResolvedValue([]);
      jest.spyOn(friendsApi, 'listIncomingRequests').mockResolvedValue([]);
      jest.spyOn(invitationsApi, 'listMyInvitations').mockResolvedValue([]);
    },
    interact: async (r) => {
      await waitFor(() => expect(r.getByTestId('empty-state')).toBeTruthy());
    },
  },
  {
    id: 'screen/friend-requests-incoming',
    name: '요청함 · 받은 요청',
    element: <FriendsRequestsScreen />,
    setup: () => {
      jest.spyOn(friendsApi, 'listIncomingRequests').mockResolvedValue([...INCOMING]);
      jest.spyOn(friendsApi, 'listOutgoingRequests').mockResolvedValue([...OUTGOING]);
      jest.spyOn(invitationsApi, 'listMyInvitations').mockResolvedValue([...INVITATIONS]);
    },
    interact: async (r) => {
      await waitFor(() => expect(r.getByText('박민수')).toBeTruthy());
      await settleTabIndicator(r);
    },
  },
  {
    id: 'screen/friend-requests-outgoing',
    name: '요청함 · 보낸 요청',
    element: <FriendsRequestsScreen />,
    setup: () => {
      jest.spyOn(friendsApi, 'listIncomingRequests').mockResolvedValue([...INCOMING]);
      jest.spyOn(friendsApi, 'listOutgoingRequests').mockResolvedValue([...OUTGOING]);
      jest.spyOn(invitationsApi, 'listMyInvitations').mockResolvedValue([...INVITATIONS]);
    },
    interact: async (r) => {
      await waitFor(() => expect(r.getByText('박민수')).toBeTruthy());
      fireEvent.press(r.getByTestId('outgoing-tab'));
      await waitFor(() => expect(r.getByText('정다은')).toBeTruthy());
      await settleTabIndicator(r);
    },
  },
  {
    id: 'screen/friend-requests-invitations',
    name: '요청함 · 모임 초대',
    element: <FriendsRequestsScreen />,
    setup: () => {
      jest.spyOn(friendsApi, 'listIncomingRequests').mockResolvedValue([...INCOMING]);
      jest.spyOn(friendsApi, 'listOutgoingRequests').mockResolvedValue([...OUTGOING]);
      jest.spyOn(invitationsApi, 'listMyInvitations').mockResolvedValue([...INVITATIONS]);
    },
    interact: async (r) => {
      await waitFor(() => expect(r.getByText('박민수')).toBeTruthy());
      fireEvent.press(r.getByTestId('invitations-tab'));
      await waitFor(() => expect(r.getByText('점심 모임')).toBeTruthy());
      await settleTabIndicator(r);
    },
  },
  {
    id: 'screen/friend-search-initial',
    name: '친구 검색 · 검색어 없음',
    element: <FriendsSearchScreen />,
    setup: () => {
      jest.spyOn(friendsApi, 'search').mockResolvedValue([]);
    },
    interact: async (r) => {
      await waitFor(() => expect(r.getByTestId('search-initial-state')).toBeTruthy());
    },
  },
  {
    id: 'screen/friend-search-results',
    name: '친구 검색 · 결과 목록',
    element: <FriendsSearchScreen />,
    setup: () => {
      jest.spyOn(friendsApi, 'search').mockResolvedValue([...SEARCH_RESULTS]);
    },
    interact: async (r) => {
      // 300ms 디바운스 뒤 검색 — 실타이머로 결과가 들어올 때까지 기다린다.
      fireEvent.changeText(r.getByTestId('search-input-field'), '김');
      await waitFor(() => expect(r.getByText('김하늘')).toBeTruthy(), { timeout: 3000 });
    },
  },
];

describe('figma-export 친구 화면 덤프', () => {
  it(`화면 ${screens.length}개를 라이트·다크로 내보낸다`, async () => {
    const artboards: IRArtboard[] = [];
    const warnings: string[] = [];

    for (const theme of ['light', 'dark'] as const) {
      useColorSchemeMock.mockReturnValue(theme);

      for (const screen of screens) {
        screen.setup();
        const r = render(<Harness>{screen.element}</Harness>);
        await act(async () => {});
        if (screen.interact) await screen.interact(r);

        const marked = findRoot(fromTestInstance(r.UNSAFE_root));
        if (!marked) throw new Error(`${screen.id}: 화면 루트를 찾지 못했습니다.`);

        const result = normalize(marked);
        let root: IRNode = result.root;
        if (root.kind === 'frame' && root.children.length === 1) root = root.children[0] ?? root;
        root.name = screen.name;

        artboards.push({
          id: `${screen.id}/${theme}`,
          group: '친구 화면',
          name: screen.name,
          theme,
          frameWidth: SCREEN_WIDTH,
          root,
        });
        warnings.push(...result.warnings.map((w) => `[${screen.id}/${theme}] ${w}`));
        r.unmount();
      }
    }

    emitPart('screens-friends', { artboards, warnings });

    expect(artboards).toHaveLength(screens.length * 2);
  }, 120_000);
});
