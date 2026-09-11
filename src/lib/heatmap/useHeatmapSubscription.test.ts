// useHeatmapSubscription — D11 Realtime broadcast subscribe hook.
//
// 검증:
// 1. mount 시 `group:${groupId}` channel 구독 + subscribe()
// 2. broadcast event='heatmap_update' 수신 → cells 업데이트 (applyHeatmapPayload)
// 3. selfMarks 변경 시 즉시 reflow (broadcast 없이도 cells override)
// 4. unmount 시 channel 정리
// 5. SUBSCRIBED 상태 → isConnected=true, CHANNEL_ERROR/TIMED_OUT → false

import { renderHook, act } from '@testing-library/react-native';
import { useHeatmapSubscription } from './useHeatmapSubscription';
import type { HeatmapPayload } from './applyPayload';

// supabase client mock — channel/send/on/subscribe/unsubscribe 캡쳐
type BroadcastHandler = (msg: { event: string; payload: HeatmapPayload }) => void;
type SubscribeCb = (status: string) => void;

interface MockChannel {
  topic: string;
  handlers: BroadcastHandler[];
  subscribed: boolean;
  on: jest.Mock;
  subscribe: jest.Mock;
  unsubscribe: jest.Mock;
  // helper for test
  emit: (payload: HeatmapPayload) => void;
  emitStatus: (status: string) => void;
  subscribeCb?: SubscribeCb;
}

const channelRegistry: Record<string, MockChannel> = {};

function createMockChannel(topic: string): MockChannel {
  const ch: MockChannel = {
    topic,
    handlers: [],
    subscribed: false,
    on: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    emit: (payload: HeatmapPayload) => {
      for (const h of ch.handlers) {
        h({ event: 'heatmap_update', payload });
      }
    },
    emitStatus: (status: string) => {
      ch.subscribeCb?.(status);
    },
  };

  ch.on.mockImplementation((type: string, filter: { event: string }, cb: BroadcastHandler) => {
    if (type === 'broadcast' && filter.event === 'heatmap_update') {
      ch.handlers.push(cb);
    }
    return ch;
  });

  ch.subscribe.mockImplementation((cb?: SubscribeCb) => {
    ch.subscribed = true;
    ch.subscribeCb = cb;
    return ch;
  });

  ch.unsubscribe.mockImplementation(() => {
    ch.subscribed = false;
    return Promise.resolve('ok');
  });

  return ch;
}

const mockSupabase = {
  channel: jest.fn((topic: string) => {
    const ch = createMockChannel(topic);
    channelRegistry[topic] = ch;
    return ch;
  }),
  removeChannel: jest.fn(),
};

jest.mock('../supabase/client', () => ({
  get supabase(): unknown {
    return mockSupabase;
  },
}));

describe('useHeatmapSubscription — D11 Realtime broadcast hook', () => {
  beforeEach(() => {
    mockSupabase.channel.mockClear();
    mockSupabase.removeChannel.mockClear();
    for (const key of Object.keys(channelRegistry)) {
      delete channelRegistry[key];
    }
  });

  test('mount 시 group:${groupId} channel 구독', () => {
    renderHook(() =>
      useHeatmapSubscription({
        groupId: 'abc-123',
        selfMarks: new Set(),
        maxCount: 7,
      }),
    );

    expect(mockSupabase.channel).toHaveBeenCalledWith('group:abc-123');
    const ch = channelRegistry['group:abc-123'];
    expect(ch).toBeDefined();
    expect(ch?.on).toHaveBeenCalledWith(
      'broadcast',
      { event: 'heatmap_update' },
      expect.any(Function),
    );
    expect(ch?.subscribe).toHaveBeenCalled();
  });

  test('초기 cells = 60×7 모두 heat-0', () => {
    const { result } = renderHook(() =>
      useHeatmapSubscription({
        groupId: 'g1',
        selfMarks: new Set(),
        maxCount: 7,
      }),
    );

    expect(result.current.cells).toHaveLength(60);
    expect(result.current.cells[0]).toHaveLength(7);
    expect(result.current.cells[0]?.[0]).toEqual({ state: 'heat-0', count: 0 });
  });

  test('broadcast 수신 시 cells 업데이트', () => {
    const { result } = renderHook(() =>
      useHeatmapSubscription({
        groupId: 'g1',
        selfMarks: new Set(),
        maxCount: 7,
      }),
    );

    const ch = channelRegistry['group:g1'];
    expect(ch).toBeDefined();

    act(() => {
      ch?.emit({
        slots: [{ day_index: 2, start_minute: 600, count: 4 }],
        updated_at: '2026-05-26T12:00:00+09:00',
      });
    });

    // row = (600-540)/15 = 4, col = 2
    expect(result.current.cells[4]?.[2]).toEqual({ state: 'heat-3', count: 4 });
  });

  test('selfMarks 변경 시 cells 즉시 reflow (broadcast 없이)', () => {
    const { result, rerender } = renderHook(
      ({ selfMarks }: { selfMarks: Set<`${number}:${number}`> }) =>
        useHeatmapSubscription({
          groupId: 'g1',
          selfMarks,
          maxCount: 7,
        }),
      { initialProps: { selfMarks: new Set<`${number}:${number}`>() } },
    );

    expect(result.current.cells[0]?.[0]).toEqual({ state: 'heat-0', count: 0 });

    rerender({ selfMarks: new Set(['0:540'] as const) });

    expect(result.current.cells[0]?.[0]).toEqual({ state: 'self', count: 1 });
  });

  test('subscribe status SUBSCRIBED → isConnected=true', () => {
    const { result } = renderHook(() =>
      useHeatmapSubscription({
        groupId: 'g1',
        selfMarks: new Set(),
        maxCount: 7,
      }),
    );

    const ch = channelRegistry['group:g1'];

    act(() => {
      ch?.emitStatus('SUBSCRIBED');
    });
    expect(result.current.isConnected).toBe(true);
  });

  test('subscribe status CHANNEL_ERROR → isConnected=false', () => {
    const { result } = renderHook(() =>
      useHeatmapSubscription({
        groupId: 'g1',
        selfMarks: new Set(),
        maxCount: 7,
      }),
    );

    const ch = channelRegistry['group:g1'];

    act(() => {
      ch?.emitStatus('SUBSCRIBED');
    });
    expect(result.current.isConnected).toBe(true);

    act(() => {
      ch?.emitStatus('CHANNEL_ERROR');
    });
    expect(result.current.isConnected).toBe(false);
  });

  test('unmount 시 channel 정리', () => {
    const { unmount } = renderHook(() =>
      useHeatmapSubscription({
        groupId: 'g1',
        selfMarks: new Set(),
        maxCount: 7,
      }),
    );

    const ch = channelRegistry['group:g1'];
    unmount();

    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(ch);
  });

  test('groupId 변경 시 기존 channel 정리 + 새 channel 구독', () => {
    const { rerender } = renderHook(
      ({ groupId }: { groupId: string }) =>
        useHeatmapSubscription({
          groupId,
          selfMarks: new Set(),
          maxCount: 7,
        }),
      { initialProps: { groupId: 'g1' } },
    );

    const ch1 = channelRegistry['group:g1'];

    rerender({ groupId: 'g2' });

    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(ch1);
    expect(mockSupabase.channel).toHaveBeenCalledWith('group:g2');
  });

  describe('초기 스냅샷 (C1 — 진입 시 타인 투표 즉시 표시)', () => {
    test('SUBSCRIBED 시 requestSnapshot 1회 호출 + 응답 payload를 cells에 적용', async () => {
      const requestSnapshot = jest.fn().mockResolvedValue({
        slots: [{ day_index: 1, start_minute: 555, count: 3 }],
        updated_at: '2026-07-25T12:00:00+09:00',
      });
      const { result } = renderHook(() =>
        useHeatmapSubscription({
          groupId: 'g1',
          selfMarks: new Set(),
          maxCount: 7,
          requestSnapshot,
        }),
      );
      const ch = channelRegistry['group:g1'];

      await act(async () => {
        ch?.emitStatus('SUBSCRIBED');
      });

      expect(requestSnapshot).toHaveBeenCalledTimes(1);
      // row = (555-540)/15 = 1, col = 1 — broadcast 없이도 진입 즉시 타인 투표 표시
      expect(result.current.cells[1]?.[1]).toEqual({ state: 'heat-2', count: 3 });
    });

    test('재연결(두 번째 SUBSCRIBED) 시에도 스냅샷 재요청 (단절 중 변경 복구)', async () => {
      const requestSnapshot = jest.fn().mockResolvedValue(null);
      renderHook(() =>
        useHeatmapSubscription({
          groupId: 'g1',
          selfMarks: new Set(),
          maxCount: 7,
          requestSnapshot,
        }),
      );
      const ch = channelRegistry['group:g1'];

      await act(async () => {
        ch?.emitStatus('SUBSCRIBED');
      });
      await act(async () => {
        ch?.emitStatus('CHANNEL_ERROR');
      });
      await act(async () => {
        ch?.emitStatus('SUBSCRIBED');
      });

      expect(requestSnapshot).toHaveBeenCalledTimes(2);
    });

    test('requestSnapshot 실패는 무해 (broadcast 경로로 계속 동작)', async () => {
      const requestSnapshot = jest.fn().mockRejectedValue(new Error('edge 미배포'));
      const { result } = renderHook(() =>
        useHeatmapSubscription({
          groupId: 'g1',
          selfMarks: new Set(),
          maxCount: 7,
          requestSnapshot,
        }),
      );
      const ch = channelRegistry['group:g1'];

      await act(async () => {
        ch?.emitStatus('SUBSCRIBED');
      });
      act(() => {
        ch?.emit({
          slots: [{ day_index: 0, start_minute: 540, count: 2 }],
          updated_at: '2026-07-25T12:00:00+09:00',
        });
      });
      expect(result.current.cells[0]?.[0]).toEqual({ state: 'heat-2', count: 2 });
    });
  });

  describe('polling 실 fetch (C2 — 단절 후 히트맵 동결 방지)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    test('polling 진입 시 즉시 + 주기적으로 requestSnapshot 호출·적용', async () => {
      const requestSnapshot = jest.fn().mockResolvedValue({
        slots: [{ day_index: 0, start_minute: 540, count: 5 }],
        updated_at: '2026-07-25T12:00:00+09:00',
      });
      const { result } = renderHook(() =>
        useHeatmapSubscription({
          groupId: 'g1',
          selfMarks: new Set(),
          maxCount: 7,
          disconnectTimeoutMs: 5000,
          pollIntervalMs: 10000,
          requestSnapshot,
        }),
      );
      const ch = channelRegistry['group:g1'];

      act(() => {
        ch?.emitStatus('CHANNEL_ERROR');
      });
      await act(async () => {
        jest.advanceTimersByTime(5000); // → polling 진입 + 즉시 1회
      });
      expect(requestSnapshot).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(10000); // 주기 fetch
      });
      expect(requestSnapshot).toHaveBeenCalledTimes(2);
      expect(result.current.cells[0]?.[0]).toEqual({ state: 'heat-3', count: 5 });
    });

    test('polling 중 SUBSCRIBED 복구 → 주기 fetch 중단', async () => {
      const requestSnapshot = jest.fn().mockResolvedValue(null);
      renderHook(() =>
        useHeatmapSubscription({
          groupId: 'g1',
          selfMarks: new Set(),
          maxCount: 7,
          disconnectTimeoutMs: 5000,
          pollIntervalMs: 10000,
          requestSnapshot,
        }),
      );
      const ch = channelRegistry['group:g1'];

      act(() => {
        ch?.emitStatus('CHANNEL_ERROR');
      });
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      const callsInPolling = requestSnapshot.mock.calls.length;

      await act(async () => {
        ch?.emitStatus('SUBSCRIBED'); // 복구 (스냅샷 1회 동반)
      });
      await act(async () => {
        jest.advanceTimersByTime(30000); // 주기 fetch는 더 이상 없어야 함
      });
      expect(requestSnapshot.mock.calls.length).toBe(callsInPolling + 1);
    });
  });

  describe('30s polling state machine (DESIGN §11.4)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('초기 status = connecting (subscribe 콜백 전)', () => {
      const { result } = renderHook(() =>
        useHeatmapSubscription({
          groupId: 'g1',
          selfMarks: new Set(),
          maxCount: 7,
        }),
      );
      expect(result.current.status).toBe('connecting');
      expect(result.current.isConnected).toBe(false);
    });

    test('disconnected 후 30s 경과 → polling', () => {
      const { result } = renderHook(() =>
        useHeatmapSubscription({
          groupId: 'g1',
          selfMarks: new Set(),
          maxCount: 7,
        }),
      );
      const ch = channelRegistry['group:g1'];

      act(() => {
        ch?.emitStatus('CHANNEL_ERROR');
      });
      expect(result.current.status).toBe('disconnected');

      act(() => {
        jest.advanceTimersByTime(30000);
      });
      expect(result.current.status).toBe('polling');
      expect(result.current.isConnected).toBe(false);
    });

    test('30s 안에 SUBSCRIBED recovery → polling 진입 안 함', () => {
      const { result } = renderHook(() =>
        useHeatmapSubscription({
          groupId: 'g1',
          selfMarks: new Set(),
          maxCount: 7,
        }),
      );
      const ch = channelRegistry['group:g1'];

      act(() => {
        ch?.emitStatus('CHANNEL_ERROR');
      });
      act(() => {
        jest.advanceTimersByTime(15000);
      });
      act(() => {
        ch?.emitStatus('SUBSCRIBED');
      });
      expect(result.current.status).toBe('connected');

      // 남은 timer 발화해도 polling으로 안 감
      act(() => {
        jest.advanceTimersByTime(30000);
      });
      expect(result.current.status).toBe('connected');
    });

    test('disconnectTimeoutMs override 지원', () => {
      const { result } = renderHook(() =>
        useHeatmapSubscription({
          groupId: 'g1',
          selfMarks: new Set(),
          maxCount: 7,
          disconnectTimeoutMs: 5000,
        }),
      );
      const ch = channelRegistry['group:g1'];

      act(() => {
        ch?.emitStatus('CHANNEL_ERROR');
      });
      act(() => {
        jest.advanceTimersByTime(4000);
      });
      expect(result.current.status).toBe('disconnected');
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(result.current.status).toBe('polling');
    });
  });
});
