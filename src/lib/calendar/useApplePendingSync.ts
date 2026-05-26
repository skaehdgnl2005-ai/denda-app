// useApplePendingSync — Apple Calendar pending row polling hook (D34).
//
// 동작:
//   1. mount 시 1회 processApplePendingPushes 호출 (앱 진입 즉시 backlog 처리)
//   2. AppState change → 'active' 전환 시 추가 호출 (사용자가 앱 background에서 복귀)
//   3. triggerSync로 수동 호출 가능 (UI 모달 등 외부 trigger)
//   4. concurrent guard: 이미 처리 중이면 새 호출 skip (디바이스 expo-calendar API 동시 호출 회피)
//   5. enabled=false → AppState listener 등록 안 함 + 호출 안 함 (사용자가 캘린더 연동 안 함)
//
// AppState는 DI(`appState` 옵션) — 테스트 친화 + RN 의존성 최소화.
// production은 react-native AppState 그대로 주입 (`src/lib/calendar/setup.ts` 어댑터 또는 caller에서).
//
// 의존: `processApplePendingPushes` from './applePending', AppleCalendarProvider.

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type ApplePendingDeps,
  type ApplePendingSummary,
  processApplePendingPushes,
} from './applePending';

// ---------------------------------------------------------------------------
// AppState 어댑터 (DI) — RN AppState API subset
// ---------------------------------------------------------------------------

export type AppStateStatus = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

export interface AppStateListenerSubscription {
  remove(): void;
}

export interface AppStateAdapter {
  /** 마지막 알려진 상태. mount 시 'active'면 즉시 trigger. */
  currentState: AppStateStatus;
  addEventListener(
    event: 'change',
    listener: (state: AppStateStatus) => void,
  ): AppStateListenerSubscription;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseApplePendingSyncOptions extends ApplePendingDeps {
  /** false면 hook 비활성. default = true. */
  enabled?: boolean;
  appState?: AppStateAdapter;
  /** sync 완료 시 호출. UI가 skippedUnauthorized=true 받아 재인증 모달 trigger 등. */
  onSummary?: (summary: ApplePendingSummary) => void;
}

export interface UseApplePendingSyncResult {
  isProcessing: boolean;
  lastSummary: ApplePendingSummary | null;
  /** UI가 수동 trigger (예: 모달 닫힌 후). 이미 처리 중이면 no-op. */
  triggerSync: () => Promise<void>;
}

export function useApplePendingSync(
  options: UseApplePendingSyncOptions,
): UseApplePendingSyncResult {
  const { supabase, apple, now, enabled = true, appState, onSummary } = options;

  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSummary, setLastSummary] = useState<ApplePendingSummary | null>(null);

  // closure 안에서 latest deps + callback 사용 위해 ref
  const inFlightRef = useRef(false);
  const depsRef = useRef<ApplePendingDeps>({ supabase, apple, now });
  depsRef.current = { supabase, apple, now };
  const onSummaryRef = useRef<UseApplePendingSyncOptions['onSummary']>(onSummary);
  onSummaryRef.current = onSummary;

  const triggerSync = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsProcessing(true);
    try {
      const summary = await processApplePendingPushes(depsRef.current);
      setLastSummary(summary);
      onSummaryRef.current?.(summary);
    } catch {
      // 본 hook은 UI에 부담 주지 않음 — 다음 trigger에서 재시도. caller가 명시적 에러 처리 원하면
      // processApplePendingPushes를 직접 호출하거나 onSummary로 partial 정보 활용
    } finally {
      inFlightRef.current = false;
      setIsProcessing(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // mount: 1회 trigger
    void triggerSync();

    if (!appState) return;

    // AppState change listener
    const sub = appState.addEventListener('change', (next) => {
      if (next === 'active') {
        void triggerSync();
      }
    });

    return () => {
      sub.remove();
    };
  }, [enabled, appState, triggerSync]);

  return { isProcessing, lastSummary, triggerSync };
}
