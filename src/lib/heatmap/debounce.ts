// createDebouncer — drag 종료 후 100ms debounce vote commit (D12 본문).
//
// 매 sweep 종료마다 createDebouncer().(payload) 호출 → 100ms 안 추가 호출 없으면 cb 실행.
// 추가 호출 있으면 timer reset + 마지막 payload만 cb로 전달.
//
// API:
//   - call(payload): 예약
//   - cancel(): pending 취소
//   - flush(): 즉시 실행 + timer 정리

export interface Debouncer<TArg> {
  (arg: TArg): void;
  cancel: () => void;
  flush: () => void;
}

export function createDebouncer<TArg>(cb: (arg: TArg) => void, delayMs: number): Debouncer<TArg> {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let lastArg: { value: TArg } | null = null;

  const run = ((arg: TArg) => {
    lastArg = { value: arg };
    if (timerId !== null) clearTimeout(timerId);
    timerId = setTimeout(() => {
      timerId = null;
      if (lastArg !== null) {
        const a = lastArg.value;
        lastArg = null;
        cb(a);
      }
    }, delayMs);
  }) as Debouncer<TArg>;

  run.cancel = (): void => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    lastArg = null;
  };

  run.flush = (): void => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (lastArg !== null) {
      const a = lastArg.value;
      lastArg = null;
      cb(a);
    }
  };

  return run;
}
