import { renderHook, act } from '@testing-library/react-native';
import { useRealtimeStatus } from './useRealtimeStatus';

type StatusCallback = (status: string, err?: Error) => void;

interface MockChannel {
  on: jest.Mock;
  subscribe: jest.Mock;
  unsubscribe: jest.Mock;
}

function createMockChannel(): {
  channel: MockChannel;
  subscribeCallbacks: StatusCallback[];
} {
  const subscribeCallbacks: StatusCallback[] = [];
  const channel: MockChannel = {
    on: jest.fn(),
    subscribe: jest.fn((cb: StatusCallback): MockChannel => {
      subscribeCallbacks.push(cb);
      return channel;
    }),
    unsubscribe: jest.fn().mockResolvedValue('ok'),
  };
  channel.on.mockReturnValue(channel);
  return { channel, subscribeCallbacks };
}

function createMockClient(channelMock: ReturnType<typeof createMockChannel>) {
  return {
    channel: jest.fn().mockReturnValue(channelMock.channel),
  };
}

describe('useRealtimeStatus', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('mount 시 client.channel + subscribe 호출, 초기 상태 connecting', () => {
    const m = createMockChannel();
    const client = createMockClient(m);

    const { result } = renderHook(() =>
      useRealtimeStatus({
        client: client as never,
        channelName: 'group:abc',
      }),
    );

    expect(client.channel).toHaveBeenCalledWith('group:abc');
    expect(m.channel.subscribe).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('connecting');
    expect(result.current.isConnected).toBe(false);
    expect(result.current.channel).toBe(m.channel);
  });

  test('SUBSCRIBED → connected (isConnected true)', () => {
    const m = createMockChannel();
    const client = createMockClient(m);
    const { result } = renderHook(() =>
      useRealtimeStatus({
        client: client as never,
        channelName: 'group:abc',
      }),
    );

    act(() => {
      m.subscribeCallbacks[0]?.('SUBSCRIBED');
    });

    expect(result.current.status).toBe('connected');
    expect(result.current.isConnected).toBe(true);
  });

  test('CHANNEL_ERROR → disconnected', () => {
    const m = createMockChannel();
    const client = createMockClient(m);
    const { result } = renderHook(() =>
      useRealtimeStatus({
        client: client as never,
        channelName: 'group:abc',
      }),
    );

    act(() => {
      m.subscribeCallbacks[0]?.('SUBSCRIBED');
    });
    act(() => {
      m.subscribeCallbacks[0]?.('CHANNEL_ERROR');
    });

    expect(result.current.status).toBe('disconnected');
    expect(result.current.isConnected).toBe(false);
  });

  test('disconnected 후 30s 경과 → polling', () => {
    const m = createMockChannel();
    const client = createMockClient(m);
    const { result } = renderHook(() =>
      useRealtimeStatus({
        client: client as never,
        channelName: 'group:abc',
      }),
    );

    act(() => {
      m.subscribeCallbacks[0]?.('CHANNEL_ERROR');
    });
    expect(result.current.status).toBe('disconnected');

    act(() => {
      jest.advanceTimersByTime(30000);
    });
    expect(result.current.status).toBe('polling');
  });

  test('30s 안에 recovery되면 polling으로 진입 안 함', () => {
    const m = createMockChannel();
    const client = createMockClient(m);
    const { result } = renderHook(() =>
      useRealtimeStatus({
        client: client as never,
        channelName: 'group:abc',
      }),
    );

    act(() => {
      m.subscribeCallbacks[0]?.('CHANNEL_ERROR');
    });
    act(() => {
      jest.advanceTimersByTime(15000);
    });
    act(() => {
      m.subscribeCallbacks[0]?.('SUBSCRIBED');
    });
    expect(result.current.status).toBe('connected');

    // 남은 15s 흘러도 polling 진입 안 함 (timer cleared)
    act(() => {
      jest.advanceTimersByTime(20000);
    });
    expect(result.current.status).toBe('connected');
  });

  test('disconnectTimeoutMs override 지원', () => {
    const m = createMockChannel();
    const client = createMockClient(m);
    const { result } = renderHook(() =>
      useRealtimeStatus({
        client: client as never,
        channelName: 'group:abc',
        disconnectTimeoutMs: 5000,
      }),
    );

    act(() => {
      m.subscribeCallbacks[0]?.('CHANNEL_ERROR');
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

  test('unmount: channel.unsubscribe 호출 + timer cleanup', () => {
    const m = createMockChannel();
    const client = createMockClient(m);
    const { unmount } = renderHook(() =>
      useRealtimeStatus({
        client: client as never,
        channelName: 'group:abc',
      }),
    );

    act(() => {
      m.subscribeCallbacks[0]?.('CHANNEL_ERROR');
    });
    unmount();

    expect(m.channel.unsubscribe).toHaveBeenCalledTimes(1);

    // unmount 후 timer 발화해도 에러 안 남 (no setState on unmounted)
    expect(() => jest.advanceTimersByTime(30000)).not.toThrow();
  });

  test('알 수 없는 status 문자열은 무시 (no transition)', () => {
    const m = createMockChannel();
    const client = createMockClient(m);
    const { result } = renderHook(() =>
      useRealtimeStatus({
        client: client as never,
        channelName: 'group:abc',
      }),
    );

    act(() => {
      m.subscribeCallbacks[0]?.('SUBSCRIBED');
    });
    act(() => {
      m.subscribeCallbacks[0]?.('UNEXPECTED_STATUS');
    });
    expect(result.current.status).toBe('connected');
  });
});
