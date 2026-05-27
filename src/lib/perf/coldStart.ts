// D25 — Cold start < 2초 계측. production binary에서 TTI(time-to-interactive) 측정.
//
// 측정 구간: JS 번들 평가 시작(모듈 로드) → 첫 화면 interactive(폰트 로드 + 루트 렌더 완료).
// 진짜 process spawn~JS 시작 구간은 native 계측(EAS Build 트랙)이 필요 — 본 모듈은
// JS가 통제 가능한 구간만 측정. runbook(docs/EAS_BUILD_RUNBOOK.md §cold-start) 참조.
//
// 시계: duration 측정이므로 wall-clock이 아니라 monotonic clock(performance.now()) 사용.
// D13(KST)은 "달력 시각 표시·저장" 규칙 — 경과시간(elapsed) 측정에는 적용 대상 아님.
// performance.now() 미존재(구형 환경) 시 Date.now() fallback.

/** D25 cold start 예산 (ms). */
export const COLD_START_BUDGET_MS = 2000;

export type NowFn = () => number;

export type ColdStartStatus = 'within_budget' | 'over_budget';

export interface ColdStartMeasurement {
  /** start → interactive 경과시간 (ms, 음수는 0으로 clamp). */
  durationMs: number;
  /** 비교 대상 예산 (ms). */
  budgetMs: number;
  /** durationMs <= budgetMs 여부. */
  withinBudget: boolean;
}

export interface ColdStartTracker {
  /** 첫 interactive 시점 측정. idempotent — 두 번째 호출부터는 첫 측정값 반환. */
  markInteractive(): ColdStartMeasurement;
  /** tracker가 잡은 start 시각 (ms). */
  getStartMs(): number;
  /** markInteractive가 이미 호출됐는지. */
  isDone(): boolean;
  /** 측정 완료된 값 (markInteractive 전이면 null). 화면 배지 등 reader용. */
  getMeasurement(): ColdStartMeasurement | null;
}

export interface ColdStartTrackerOptions {
  /** 시계 주입 (테스트). 기본 defaultNow. */
  now?: NowFn;
  /** 예산 override. 기본 COLD_START_BUDGET_MS. */
  budgetMs?: number;
  /** start 시각 override. 미지정 시 생성 시점 now(). */
  startMs?: number;
  /** 첫 측정 완료 시 1회 호출 (로깅·analytics 주입점). */
  onMeasure?: (m: ColdStartMeasurement) => void;
}

/** monotonic clock — performance.now() 우선, 없으면 Date.now(). */
export function defaultNow(): number {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  if (perf && typeof perf.now === 'function') {
    return perf.now();
  }
  return Date.now();
}

/** start/interactive 시각으로 측정값 산출 (pure). */
export function measureColdStart(
  startMs: number,
  interactiveMs: number,
  budgetMs: number = COLD_START_BUDGET_MS,
): ColdStartMeasurement {
  const durationMs = Math.max(0, interactiveMs - startMs);
  return { durationMs, budgetMs, withinBudget: durationMs <= budgetMs };
}

/** duration을 예산 대비 분류 (pure). */
export function classifyColdStart(
  durationMs: number,
  budgetMs: number = COLD_START_BUDGET_MS,
): ColdStartStatus {
  return durationMs <= budgetMs ? 'within_budget' : 'over_budget';
}

/** 측정값을 사람이 읽는 로그 문자열로 (adb logcat / Console.app에서 D25 판독). */
export function formatColdStartLog(m: ColdStartMeasurement): string {
  const status = m.withinBudget ? '✅ 예산 내' : '⚠️ 예산 초과';
  return `[cold-start] ${m.durationMs.toFixed(0)}ms / ${m.budgetMs}ms ${status} (D25)`;
}

/** cold start tracker 생성. start 시각을 즉시 capture. */
export function createColdStartTracker(options: ColdStartTrackerOptions = {}): ColdStartTracker {
  const now = options.now ?? defaultNow;
  const budgetMs = options.budgetMs ?? COLD_START_BUDGET_MS;
  const startMs = options.startMs ?? now();
  let measurement: ColdStartMeasurement | null = null;

  return {
    markInteractive(): ColdStartMeasurement {
      if (measurement !== null) {
        return measurement;
      }
      measurement = measureColdStart(startMs, now(), budgetMs);
      options.onMeasure?.(measurement);
      return measurement;
    },
    getStartMs: () => startMs,
    isDone: () => measurement !== null,
    getMeasurement: () => measurement,
  };
}

/**
 * cold-start 화면 배지 노출 여부 (pure).
 * dev 빌드는 항상, release 빌드는 EXPO_PUBLIC_PERF_OVERLAY === '1'일 때만.
 * production 프로파일은 env를 안 주입하므로 자연히 false → UX 영향 0.
 */
export function isPerfOverlayEnabled(isDev: boolean, envFlag: string | undefined): boolean {
  return isDev || envFlag === '1';
}

// --- 앱 전역 singleton ---
// 모듈 로드 시점을 JS 번들 평가 시작 근사치로 capture. _layout.tsx가 첫 화면 준비 후
// markInteractive() 호출.

const MODULE_LOAD_MS = defaultNow();
let appTracker: ColdStartTracker | null = null;

/** 앱 전역 cold start tracker (singleton). 모듈 로드 시각을 start로 사용. */
export function getAppColdStartTracker(): ColdStartTracker {
  if (appTracker === null) {
    appTracker = createColdStartTracker({
      startMs: MODULE_LOAD_MS,
      onMeasure: (m) => {
        // 베타: console으로 on-device 판독 (release 빌드도 adb logcat / Console.app에 노출).
        // production 안정화 시 Sentry/analytics로 라우팅 (onMeasure 교체).
        // eslint-disable-next-line no-console
        console.log(formatColdStartLog(m));
      },
    });
  }
  return appTracker;
}

/** 테스트 전용 — singleton 초기화. */
export function _resetAppColdStartTracker(): void {
  appTracker = null;
}
