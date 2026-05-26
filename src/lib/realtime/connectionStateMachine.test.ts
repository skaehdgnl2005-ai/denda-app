import {
  initialConnectionState,
  reduceConnectionState,
  type ConnectionState,
  type ConnectionEvent,
} from './connectionStateMachine';

describe('connectionStateMachine', () => {
  test('초기 상태 = connecting', () => {
    expect(initialConnectionState).toBe<ConnectionState>('connecting');
  });

  describe('connecting 상태에서', () => {
    test('subscribed → connected', () => {
      expect(reduceConnectionState('connecting', { type: 'subscribed' })).toBe('connected');
    });

    test('error → disconnected', () => {
      expect(reduceConnectionState('connecting', { type: 'error' })).toBe('disconnected');
    });

    test('timeout → disconnected', () => {
      expect(reduceConnectionState('connecting', { type: 'timeout' })).toBe('disconnected');
    });

    test('closed → disconnected', () => {
      expect(reduceConnectionState('connecting', { type: 'closed' })).toBe('disconnected');
    });

    test('disconnect_timeout → connecting (stale timer, 무시)', () => {
      expect(reduceConnectionState('connecting', { type: 'disconnect_timeout' })).toBe(
        'connecting',
      );
    });
  });

  describe('connected 상태에서', () => {
    test('subscribed → connected (idempotent)', () => {
      expect(reduceConnectionState('connected', { type: 'subscribed' })).toBe('connected');
    });

    test('error → disconnected', () => {
      expect(reduceConnectionState('connected', { type: 'error' })).toBe('disconnected');
    });

    test('closed → disconnected', () => {
      expect(reduceConnectionState('connected', { type: 'closed' })).toBe('disconnected');
    });

    test('disconnect_timeout → connected (stale timer, 무시)', () => {
      expect(reduceConnectionState('connected', { type: 'disconnect_timeout' })).toBe('connected');
    });
  });

  describe('disconnected 상태에서', () => {
    test('subscribed → connected (recovery)', () => {
      expect(reduceConnectionState('disconnected', { type: 'subscribed' })).toBe('connected');
    });

    test('disconnect_timeout → polling', () => {
      expect(reduceConnectionState('disconnected', { type: 'disconnect_timeout' })).toBe('polling');
    });

    test('error → disconnected (idempotent)', () => {
      expect(reduceConnectionState('disconnected', { type: 'error' })).toBe('disconnected');
    });
  });

  describe('polling 상태에서', () => {
    test('subscribed → connected (recovery)', () => {
      expect(reduceConnectionState('polling', { type: 'subscribed' })).toBe('connected');
    });

    test('error → polling (이미 폴링 중, 유지)', () => {
      expect(reduceConnectionState('polling', { type: 'error' })).toBe('polling');
    });

    test('disconnect_timeout → polling (이미 폴링)', () => {
      expect(reduceConnectionState('polling', { type: 'disconnect_timeout' })).toBe('polling');
    });
  });

  test('typed: 알 수 없는 event 무시 (defensive)', () => {
    // TS는 막아주지만 런타임 안전성 확인
    const e = { type: 'unknown' } as unknown as ConnectionEvent;
    expect(reduceConnectionState('connected', e)).toBe('connected');
  });
});
