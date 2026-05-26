// useApplePendingSync — RTL hook unit tests.
// applePending lib + supabase + AppleCalendarProvider 모두 DI mock으로 격리.

import { renderHook, act, waitFor } from '@testing-library/react-native';

import {
  type AppStateAdapter,
  type AppStateStatus,
  useApplePendingSync,
} from './useApplePendingSync';
import { processApplePendingPushes, type ApplePendingSummary } from './applePending';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppleCalendarProvider } from './apple';

jest.mock('./applePending', () => ({
  processApplePendingPushes: jest.fn(),
}));

const mockedProcess = processApplePendingPushes as jest.MockedFunction<
  typeof processApplePendingPushes
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAppStateMock(initial: AppStateStatus = 'active'): AppStateAdapter & {
  __fire: (state: AppStateStatus) => void;
  __removeCalls: number;
} {
  let listener: ((state: AppStateStatus) => void) | null = null;
  const removeCalls = { count: 0 };

  return {
    currentState: initial,
    addEventListener: jest.fn().mockImplementation((_event, cb) => {
      listener = cb;
      return {
        remove: () => {
          removeCalls.count++;
          listener = null;
        },
      };
    }),
    __fire: (state: AppStateStatus) => {
      listener?.(state);
    },
    get __removeCalls() {
      return removeCalls.count;
    },
  } as AppStateAdapter & {
    __fire: (state: AppStateStatus) => void;
    __removeCalls: number;
  };
}

const noopSupabase = {} as unknown as SupabaseClient;
const noopApple = {
  isAuthorized: jest.fn(),
  insertEvent: jest.fn(),
} as unknown as AppleCalendarProvider;
const now = () => '2026-05-26T12:00:00+00:00';

beforeEach(() => {
  mockedProcess.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useApplePendingSync', () => {
  it('mount 시 processApplePendingPushes 1회 호출', async () => {
    const summary: ApplePendingSummary = {
      completed: 1,
      failed: 0,
      skippedUnauthorized: false,
    };
    mockedProcess.mockResolvedValue(summary);
    const onSummary = jest.fn();

    const { result } = renderHook(() =>
      useApplePendingSync({ supabase: noopSupabase, apple: noopApple, now, onSummary }),
    );

    await waitFor(() => {
      expect(mockedProcess).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(result.current.lastSummary).toEqual(summary);
    });
    expect(onSummary).toHaveBeenCalledWith(summary);
  });

  it('enabled=false → 호출 안 함', () => {
    mockedProcess.mockResolvedValue({
      completed: 0,
      failed: 0,
      skippedUnauthorized: false,
    });

    renderHook(() =>
      useApplePendingSync({
        supabase: noopSupabase,
        apple: noopApple,
        now,
        enabled: false,
      }),
    );

    expect(mockedProcess).not.toHaveBeenCalled();
  });

  it('AppState change → active 전환 시 추가 호출', async () => {
    mockedProcess.mockResolvedValue({
      completed: 0,
      failed: 0,
      skippedUnauthorized: false,
    });
    const appState = makeAppStateMock('active');

    renderHook(() =>
      useApplePendingSync({
        supabase: noopSupabase,
        apple: noopApple,
        now,
        appState,
      }),
    );

    // mount 호출 1회
    await waitFor(() => expect(mockedProcess).toHaveBeenCalledTimes(1));

    // background로 갔다가 active로 복귀
    await act(async () => {
      appState.__fire('background');
    });
    expect(mockedProcess).toHaveBeenCalledTimes(1);

    await act(async () => {
      appState.__fire('active');
    });
    await waitFor(() => expect(mockedProcess).toHaveBeenCalledTimes(2));
  });

  it('AppState change → active 외 상태 → 호출 안 됨', async () => {
    mockedProcess.mockResolvedValue({
      completed: 0,
      failed: 0,
      skippedUnauthorized: false,
    });
    const appState = makeAppStateMock('active');

    renderHook(() =>
      useApplePendingSync({
        supabase: noopSupabase,
        apple: noopApple,
        now,
        appState,
      }),
    );

    await waitFor(() => expect(mockedProcess).toHaveBeenCalledTimes(1));

    await act(async () => {
      appState.__fire('background');
      appState.__fire('inactive');
      appState.__fire('unknown');
    });
    expect(mockedProcess).toHaveBeenCalledTimes(1);
  });

  it('concurrent guard: 처리 중인 동안 새 trigger 호출 시 skip', async () => {
    let resolveFirst: ((value: ApplePendingSummary) => void) | null = null;
    mockedProcess.mockImplementationOnce(
      () =>
        new Promise<ApplePendingSummary>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    mockedProcess.mockResolvedValue({
      completed: 0,
      failed: 0,
      skippedUnauthorized: false,
    });

    const appState = makeAppStateMock('active');
    renderHook(() =>
      useApplePendingSync({
        supabase: noopSupabase,
        apple: noopApple,
        now,
        appState,
      }),
    );

    // mount의 첫 호출이 still pending
    await waitFor(() => expect(mockedProcess).toHaveBeenCalledTimes(1));

    // 처리 중에 AppState active fire — 추가 호출 skip
    await act(async () => {
      appState.__fire('active');
    });
    expect(mockedProcess).toHaveBeenCalledTimes(1);

    // 첫 호출 resolve → guard 해제 → 다음 fire는 호출
    await act(async () => {
      resolveFirst?.({ completed: 1, failed: 0, skippedUnauthorized: false });
    });

    await act(async () => {
      appState.__fire('active');
    });
    await waitFor(() => expect(mockedProcess).toHaveBeenCalledTimes(2));
  });

  it('processApplePendingPushes throw → hook 부담 안 줌, lastSummary는 null 유지, 다음 trigger 시 재시도', async () => {
    mockedProcess.mockRejectedValueOnce(new Error('select error'));
    mockedProcess.mockResolvedValue({
      completed: 1,
      failed: 0,
      skippedUnauthorized: false,
    });
    const appState = makeAppStateMock('active');

    const { result } = renderHook(() =>
      useApplePendingSync({
        supabase: noopSupabase,
        apple: noopApple,
        now,
        appState,
      }),
    );

    await waitFor(() => expect(mockedProcess).toHaveBeenCalledTimes(1));
    // throw 후에도 isProcessing 해제, lastSummary는 null 유지
    await waitFor(() => expect(result.current.isProcessing).toBe(false));
    expect(result.current.lastSummary).toBeNull();

    // 재시도
    await act(async () => {
      appState.__fire('background');
      appState.__fire('active');
    });
    await waitFor(() => expect(mockedProcess).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(result.current.lastSummary).toEqual({
        completed: 1,
        failed: 0,
        skippedUnauthorized: false,
      }),
    );
  });

  it('unmount → AppState listener 해제', async () => {
    mockedProcess.mockResolvedValue({
      completed: 0,
      failed: 0,
      skippedUnauthorized: false,
    });
    const appState = makeAppStateMock('active');

    const { unmount } = renderHook(() =>
      useApplePendingSync({
        supabase: noopSupabase,
        apple: noopApple,
        now,
        appState,
      }),
    );

    await waitFor(() => expect(mockedProcess).toHaveBeenCalledTimes(1));
    expect(appState.__removeCalls).toBe(0);

    unmount();
    expect(appState.__removeCalls).toBe(1);
  });

  it('triggerSync — UI 수동 호출 가능', async () => {
    mockedProcess.mockResolvedValue({
      completed: 0,
      failed: 0,
      skippedUnauthorized: true,
    });

    const { result } = renderHook(() =>
      useApplePendingSync({
        supabase: noopSupabase,
        apple: noopApple,
        now,
        enabled: false, // mount 자동 호출 막고 수동 trigger만 테스트
      }),
    );

    expect(mockedProcess).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.triggerSync();
    });
    expect(mockedProcess).toHaveBeenCalledTimes(1);
    expect(result.current.lastSummary).toEqual({
      completed: 0,
      failed: 0,
      skippedUnauthorized: true,
    });
  });
});
