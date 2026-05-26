import { createCommitDebouncer } from './debouncer';

describe('createCommitDebouncer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('schedule 후 delay 만큼 흐르면 commit 호출', () => {
    const onCommit = jest.fn();
    const d = createCommitDebouncer({ delayMs: 100, onCommit });
    d.schedule('payload-A');
    expect(onCommit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('payload-A');
  });

  test('delay 안에 두 번 schedule하면 마지막 payload만 1회 commit', () => {
    const onCommit = jest.fn();
    const d = createCommitDebouncer({ delayMs: 100, onCommit });
    d.schedule('A');
    jest.advanceTimersByTime(50);
    d.schedule('B');
    jest.advanceTimersByTime(50); // 총 100ms이지만 마지막 schedule 기점 50ms
    expect(onCommit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(50); // 마지막 schedule 기점 100ms 도달
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('B');
  });

  test('flush: 대기 중 commit 즉시 실행', () => {
    const onCommit = jest.fn();
    const d = createCommitDebouncer({ delayMs: 100, onCommit });
    d.schedule('X');
    d.flush();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('X');
    // flush 이후 timer는 비어 있어야 함
    jest.advanceTimersByTime(200);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  test('flush: 대기 중 commit이 없으면 no-op', () => {
    const onCommit = jest.fn();
    const d = createCommitDebouncer({ delayMs: 100, onCommit });
    d.flush();
    expect(onCommit).not.toHaveBeenCalled();
  });

  test('cancel: 대기 중 commit 무시', () => {
    const onCommit = jest.fn();
    const d = createCommitDebouncer({ delayMs: 100, onCommit });
    d.schedule('X');
    d.cancel();
    jest.advanceTimersByTime(200);
    expect(onCommit).not.toHaveBeenCalled();
  });

  test('schedule 후 commit, 다시 schedule하면 새 cycle 시작', () => {
    const onCommit = jest.fn();
    const d = createCommitDebouncer({ delayMs: 100, onCommit });
    d.schedule('A');
    jest.advanceTimersByTime(100);
    expect(onCommit).toHaveBeenCalledWith('A');
    d.schedule('B');
    jest.advanceTimersByTime(100);
    expect(onCommit).toHaveBeenCalledWith('B');
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  test('onCommit이 throw해도 다음 schedule이 정상 작동', () => {
    const onCommit = jest.fn().mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const d = createCommitDebouncer({ delayMs: 100, onCommit });
    d.schedule('A');
    expect(() => jest.advanceTimersByTime(100)).toThrow('boom');
    d.schedule('B');
    jest.advanceTimersByTime(100);
    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(onCommit).toHaveBeenLastCalledWith('B');
  });
});
