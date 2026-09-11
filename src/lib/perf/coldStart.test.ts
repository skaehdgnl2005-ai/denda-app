// D25 — Cold start < 2초 계측 단위 테스트 (TDD-first).

import {
  COLD_START_BUDGET_MS,
  classifyColdStart,
  createColdStartTracker,
  defaultNow,
  formatColdStartLog,
  getAppColdStartTracker,
  isPerfOverlayEnabled,
  measureColdStart,
  _resetAppColdStartTracker,
} from './coldStart';

/** 호출마다 큐의 다음 값을 반환하는 결정적 now (마지막 값은 반복). */
function makeNow(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)] ?? 0;
    i += 1;
    return v;
  };
}

describe('COLD_START_BUDGET_MS', () => {
  it('D25 예산은 2000ms', () => {
    expect(COLD_START_BUDGET_MS).toBe(2000);
  });
});

describe('measureColdStart', () => {
  it('duration = interactive - start', () => {
    const m = measureColdStart(100, 1600);
    expect(m.durationMs).toBe(1500);
    expect(m.budgetMs).toBe(2000);
    expect(m.withinBudget).toBe(true);
  });

  it('예산 초과 시 withinBudget=false', () => {
    const m = measureColdStart(0, 2500);
    expect(m.durationMs).toBe(2500);
    expect(m.withinBudget).toBe(false);
  });

  it('정확히 예산(2000ms)이면 within (<=)', () => {
    const m = measureColdStart(0, 2000);
    expect(m.durationMs).toBe(2000);
    expect(m.withinBudget).toBe(true);
  });

  it('interactive < start (clock 역행)이면 0으로 clamp', () => {
    const m = measureColdStart(500, 100);
    expect(m.durationMs).toBe(0);
    expect(m.withinBudget).toBe(true);
  });

  it('custom budgetMs 적용', () => {
    const m = measureColdStart(0, 1200, 1000);
    expect(m.budgetMs).toBe(1000);
    expect(m.withinBudget).toBe(false);
  });
});

describe('classifyColdStart', () => {
  it('예산 이하 → within_budget', () => {
    expect(classifyColdStart(1500)).toBe('within_budget');
    expect(classifyColdStart(2000)).toBe('within_budget');
  });

  it('예산 초과 → over_budget', () => {
    expect(classifyColdStart(2001)).toBe('over_budget');
  });

  it('custom budget 적용', () => {
    expect(classifyColdStart(900, 1000)).toBe('within_budget');
    expect(classifyColdStart(1100, 1000)).toBe('over_budget');
  });
});

describe('formatColdStartLog', () => {
  it('duration/budget/D25 포함 + 소수 반올림', () => {
    const log = formatColdStartLog(measureColdStart(0, 1499.7));
    expect(log).toContain('1500ms');
    expect(log).toContain('2000ms');
    expect(log).toContain('D25');
  });

  it('within과 over 마커가 다르다', () => {
    const within = formatColdStartLog(measureColdStart(0, 1000));
    const over = formatColdStartLog(measureColdStart(0, 3000));
    expect(within).not.toBe(over);
    expect(within).toContain('✅');
    expect(over).toContain('⚠️');
  });
});

describe('createColdStartTracker', () => {
  it('주입된 now/startMs로 duration 측정', () => {
    const tracker = createColdStartTracker({ now: makeNow([1700]), startMs: 200 });
    const m = tracker.markInteractive();
    expect(m.durationMs).toBe(1500);
    expect(tracker.getStartMs()).toBe(200);
  });

  it('startMs 미지정 시 생성 시점 now()를 start로 사용', () => {
    const tracker = createColdStartTracker({ now: makeNow([100, 900]) });
    expect(tracker.getStartMs()).toBe(100);
    expect(tracker.markInteractive().durationMs).toBe(800);
  });

  it('markInteractive는 idempotent — 첫 측정만 유효', () => {
    const now = makeNow([0, 1000, 5000]);
    const tracker = createColdStartTracker({ now });
    const first = tracker.markInteractive();
    const second = tracker.markInteractive();
    expect(first.durationMs).toBe(1000);
    expect(second).toEqual(first);
  });

  it('onMeasure는 첫 markInteractive에서 1회만 호출', () => {
    const onMeasure = jest.fn();
    const tracker = createColdStartTracker({ now: makeNow([0, 1200]), onMeasure });
    tracker.markInteractive();
    tracker.markInteractive();
    expect(onMeasure).toHaveBeenCalledTimes(1);
    const [firstCall] = onMeasure.mock.calls;
    expect(firstCall?.[0]).toEqual(expect.objectContaining({ durationMs: 1200 }));
  });

  it('isDone은 markInteractive 전 false, 후 true', () => {
    const tracker = createColdStartTracker({ now: makeNow([0, 100]) });
    expect(tracker.isDone()).toBe(false);
    tracker.markInteractive();
    expect(tracker.isDone()).toBe(true);
  });

  it('getMeasurement은 markInteractive 전 null, 후 측정값', () => {
    const tracker = createColdStartTracker({ now: makeNow([0, 1300]) });
    expect(tracker.getMeasurement()).toBeNull();
    const m = tracker.markInteractive();
    expect(tracker.getMeasurement()).toEqual(m);
    expect(tracker.getMeasurement()?.durationMs).toBe(1300);
  });
});

describe('isPerfOverlayEnabled', () => {
  it('__DEV__이면 항상 true', () => {
    expect(isPerfOverlayEnabled(true, undefined)).toBe(true);
    expect(isPerfOverlayEnabled(true, '0')).toBe(true);
  });

  it('dev 아니어도 env flag "1"이면 true (preview/internal 빌드)', () => {
    expect(isPerfOverlayEnabled(false, '1')).toBe(true);
  });

  it('dev 아니고 flag 없거나 "1" 아니면 false (production 안전)', () => {
    expect(isPerfOverlayEnabled(false, undefined)).toBe(false);
    expect(isPerfOverlayEnabled(false, '0')).toBe(false);
    expect(isPerfOverlayEnabled(false, 'true')).toBe(false);
  });
});

describe('getAppColdStartTracker (singleton)', () => {
  beforeEach(() => {
    _resetAppColdStartTracker();
  });

  it('반복 호출 시 같은 인스턴스 반환', () => {
    const a = getAppColdStartTracker();
    const b = getAppColdStartTracker();
    expect(a).toBe(b);
  });

  it('_resetAppColdStartTracker 후 새 인스턴스', () => {
    const a = getAppColdStartTracker();
    _resetAppColdStartTracker();
    const b = getAppColdStartTracker();
    expect(a).not.toBe(b);
  });
});

describe('defaultNow', () => {
  it('숫자를 반환', () => {
    expect(typeof defaultNow()).toBe('number');
  });
});
