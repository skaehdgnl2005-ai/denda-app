// S05c — drag 종료 commit 100ms debouncer (D11/D12).
//
// 사용 패턴 (S05b drag worklet 통합 시점):
//   const debouncer = createCommitDebouncer({
//     delayMs: 100,
//     onCommit: (slots) => commitVoteDiff(supabase, { groupId, userId, ...diff }),
//   });
//   gesture.onEnd(() => { 'worklet'; runOnJS(debouncer.schedule)(latestSlots) })

export interface CommitDebouncerConfig<T> {
  delayMs: number;
  onCommit: (payload: T) => void;
}

export interface CommitDebouncer<T> {
  schedule: (payload: T) => void;
  flush: () => void;
  cancel: () => void;
}

export function createCommitDebouncer<T>(config: CommitDebouncerConfig<T>): CommitDebouncer<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { payload: T } | null = null;

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const fire = (): void => {
    const snapshot = pending;
    clearTimer();
    pending = null;
    if (snapshot !== null) {
      config.onCommit(snapshot.payload);
    }
  };

  return {
    schedule(payload: T): void {
      pending = { payload };
      clearTimer();
      timer = setTimeout(fire, config.delayMs);
    },
    flush(): void {
      if (pending !== null) {
        fire();
      }
    },
    cancel(): void {
      clearTimer();
      pending = null;
    },
  };
}
