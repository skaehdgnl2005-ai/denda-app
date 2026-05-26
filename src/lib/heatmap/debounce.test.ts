// debounceCommit — drag 종료 후 100ms 내 추가 sweep 있으면 reset, 없으면 commit.
// D12 본문: "Vote commit = drag 종료 시 1회 + 100ms debounce".
//
// jest fake timers로 결정적 테스트.

import { createDebouncer } from './debounce';

describe('createDebouncer — 100ms debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('호출 후 100ms 지나면 callback 실행', () => {
    const cb = jest.fn();
    const debounced = createDebouncer(cb, 100);

    debounced('payload-1');
    expect(cb).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(cb).toHaveBeenCalledWith('payload-1');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test('100ms 안에 재호출 시 timer reset → 마지막 payload만 commit', () => {
    const cb = jest.fn();
    const debounced = createDebouncer(cb, 100);

    debounced('first');
    jest.advanceTimersByTime(50);
    debounced('second');
    jest.advanceTimersByTime(50);
    expect(cb).not.toHaveBeenCalled(); // 100ms 안 됨 (reset)

    jest.advanceTimersByTime(50);
    expect(cb).toHaveBeenCalledWith('second');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test('cancel() 호출 시 pending callback 실행 안 함', () => {
    const cb = jest.fn();
    const debounced = createDebouncer(cb, 100);

    debounced('payload');
    debounced.cancel();
    jest.advanceTimersByTime(100);

    expect(cb).not.toHaveBeenCalled();
  });

  test('flush() 호출 시 즉시 callback 실행 + timer 정리', () => {
    const cb = jest.fn();
    const debounced = createDebouncer(cb, 100);

    debounced('payload');
    debounced.flush();
    expect(cb).toHaveBeenCalledWith('payload');

    jest.advanceTimersByTime(100);
    expect(cb).toHaveBeenCalledTimes(1); // flush 후 timer 재발화 안 함
  });

  test('flush() 호출 시 pending 없으면 no-op', () => {
    const cb = jest.fn();
    const debounced = createDebouncer(cb, 100);

    debounced.flush();
    expect(cb).not.toHaveBeenCalled();
  });
});
