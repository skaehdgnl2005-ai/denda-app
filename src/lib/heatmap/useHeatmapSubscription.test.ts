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
});
