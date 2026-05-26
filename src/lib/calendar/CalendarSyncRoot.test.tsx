// S06-applesync-wireup — CalendarSyncRoot DI 컴포넌트 tests.
//
// 검증: preference 따라 enabled flag 전환 + apple provider lazy 구성. 자세한 hook 동작은
// useApplePendingSync.test.ts에서 검증 — 본 테스트는 wire-up integration만.

import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

import { CalendarSyncRoot } from './CalendarSyncRoot';
import type { AppleCalendarProvider } from './apple';
import type { AppStateAdapter, AppStateStatus } from './useApplePendingSync';

const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeStubAppleProvider(): AppleCalendarProvider {
  return {
    providerName: 'apple_ios',
    isAuthorized: jest.fn().mockResolvedValue(false),
    requestPermission: jest.fn().mockResolvedValue(undefined),
    insertEvent: jest.fn(),
  } as unknown as AppleCalendarProvider;
}

function makeAppState(initial: AppStateStatus = 'active'): AppStateAdapter & {
  emit: (state: AppStateStatus) => void;
} {
  const listeners: ((state: AppStateStatus) => void)[] = [];
  return {
    currentState: initial,
    addEventListener: (_event, listener) => {
      listeners.push(listener);
      return {
        remove: () => {
          const idx = listeners.indexOf(listener);
          if (idx >= 0) listeners.splice(idx, 1);
        },
      };
    },
    emit: (state) => listeners.forEach((l) => l(state)),
  };
}

function makeSupabaseStub(): {
  from: jest.Mock;
} {
  // processApplePendingPushes calls supabase.from(TABLE).select(...).is(...).order(...)
  // For tests we return a resolving empty array so hook completes without error.
  const order = jest.fn().mockResolvedValue({ data: [], error: null });
  const is = jest.fn().mockReturnValue({ order });
  const select = jest.fn().mockReturnValue({ is });
  const from = jest.fn().mockReturnValue({ select });
  return { from };
}

describe('CalendarSyncRoot', () => {
  test('userId=undefined → fetchPreference 호출 안 함, apple 생성 안 함', async () => {
    const fetchPreference = jest.fn();
    const createAppleProvider = jest.fn();
    const appState = makeAppState();
    const supabase = makeSupabaseStub();

    render(
      <CalendarSyncRoot
        userId={undefined}
        supabase={supabase as never}
        fetchPreference={fetchPreference}
        createAppleProvider={createAppleProvider}
        appState={appState}
        now={() => 'now'}
      />,
    );
    expect(fetchPreference).not.toHaveBeenCalled();
    expect(createAppleProvider).not.toHaveBeenCalled();
  });

  test('preference=null → enabled=false, apple 생성 안 함', async () => {
    const fetchPreference = jest.fn().mockResolvedValue(null);
    const createAppleProvider = jest.fn();
    const appState = makeAppState();
    const supabase = makeSupabaseStub();

    render(
      <CalendarSyncRoot
        userId={USER_ID}
        supabase={supabase as never}
        fetchPreference={fetchPreference}
        createAppleProvider={createAppleProvider}
        appState={appState}
        now={() => 'now'}
      />,
    );
    await waitFor(() => {
      expect(fetchPreference).toHaveBeenCalledWith(USER_ID);
    });
    expect(createAppleProvider).not.toHaveBeenCalled();
  });

  test('preference="none" → apple 생성 안 함', async () => {
    const fetchPreference = jest.fn().mockResolvedValue('none');
    const createAppleProvider = jest.fn();

    render(
      <CalendarSyncRoot
        userId={USER_ID}
        supabase={makeSupabaseStub() as never}
        fetchPreference={fetchPreference}
        createAppleProvider={createAppleProvider}
        appState={makeAppState()}
        now={() => 'now'}
      />,
    );
    await waitFor(() => {
      expect(fetchPreference).toHaveBeenCalled();
    });
    expect(createAppleProvider).not.toHaveBeenCalled();
  });

  test('preference="google" → apple 생성 안 함 (Google만 사용자)', async () => {
    const fetchPreference = jest.fn().mockResolvedValue('google');
    const createAppleProvider = jest.fn();

    render(
      <CalendarSyncRoot
        userId={USER_ID}
        supabase={makeSupabaseStub() as never}
        fetchPreference={fetchPreference}
        createAppleProvider={createAppleProvider}
        appState={makeAppState()}
        now={() => 'now'}
      />,
    );
    await waitFor(() => {
      expect(fetchPreference).toHaveBeenCalled();
    });
    expect(createAppleProvider).not.toHaveBeenCalled();
  });

  test('preference="apple_ios" → apple 생성 + 즉시 hook trigger (mount)', async () => {
    const apple = makeStubAppleProvider();
    const fetchPreference = jest.fn().mockResolvedValue('apple_ios');
    const createAppleProvider = jest.fn().mockReturnValue(apple);
    const supabase = makeSupabaseStub();

    render(
      <CalendarSyncRoot
        userId={USER_ID}
        supabase={supabase as never}
        fetchPreference={fetchPreference}
        createAppleProvider={createAppleProvider}
        appState={makeAppState()}
        now={() => 'now'}
      />,
    );
    await waitFor(() => {
      expect(createAppleProvider).toHaveBeenCalled();
    });
    // hook이 enabled로 supabase SELECT 호출했어야 함 (processApplePendingPushes 진입)
    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('calendar_push_apple_pending');
    });
  });

  test('preference="both" → apple 생성', async () => {
    const apple = makeStubAppleProvider();
    const fetchPreference = jest.fn().mockResolvedValue('both');
    const createAppleProvider = jest.fn().mockReturnValue(apple);

    render(
      <CalendarSyncRoot
        userId={USER_ID}
        supabase={makeSupabaseStub() as never}
        fetchPreference={fetchPreference}
        createAppleProvider={createAppleProvider}
        appState={makeAppState()}
        now={() => 'now'}
      />,
    );
    await waitFor(() => {
      expect(createAppleProvider).toHaveBeenCalled();
    });
  });

  test('createAppleProvider throw (expo-* 미설치) → silent (crash 없음)', async () => {
    const fetchPreference = jest.fn().mockResolvedValue('apple_ios');
    const createAppleProvider = jest.fn().mockImplementation(() => {
      throw new Error('expo-calendar 미설치');
    });

    let renderResult: ReturnType<typeof render> | null = null;
    expect(() => {
      renderResult = render(
        <CalendarSyncRoot
          userId={USER_ID}
          supabase={makeSupabaseStub() as never}
          fetchPreference={fetchPreference}
          createAppleProvider={createAppleProvider}
          appState={makeAppState()}
          now={() => 'now'}
        />,
      );
    }).not.toThrow();
    await waitFor(() => {
      expect(createAppleProvider).toHaveBeenCalled();
    });
    expect(renderResult).not.toBeNull();
  });

  test('fetchPreference 에러 → silent (crash 없음)', async () => {
    const fetchPreference = jest.fn().mockRejectedValue(new Error('rls'));
    const createAppleProvider = jest.fn();

    expect(() => {
      render(
        <CalendarSyncRoot
          userId={USER_ID}
          supabase={makeSupabaseStub() as never}
          fetchPreference={fetchPreference}
          createAppleProvider={createAppleProvider}
          appState={makeAppState()}
          now={() => 'now'}
        />,
      );
    }).not.toThrow();
    await waitFor(() => {
      expect(fetchPreference).toHaveBeenCalled();
    });
    expect(createAppleProvider).not.toHaveBeenCalled();
  });

  test('AppState change → active 전환 시 sync 재호출 (apple_ios 활성 상태)', async () => {
    const apple = makeStubAppleProvider();
    const fetchPreference = jest.fn().mockResolvedValue('apple_ios');
    const createAppleProvider = jest.fn().mockReturnValue(apple);
    const supabase = makeSupabaseStub();
    const appState = makeAppState('active');

    render(
      <CalendarSyncRoot
        userId={USER_ID}
        supabase={supabase as never}
        fetchPreference={fetchPreference}
        createAppleProvider={createAppleProvider}
        appState={appState}
        now={() => 'now'}
      />,
    );
    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalled();
    });
    const initialCalls = supabase.from.mock.calls.length;
    await act(async () => {
      appState.emit('background');
      appState.emit('active');
    });
    // background → active 전환 시 추가 호출 발생
    await waitFor(() => {
      expect(supabase.from.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });
});
