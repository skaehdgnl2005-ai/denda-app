// S06-applesync-wireup — Apple Calendar sync 전역 wire-up 컴포넌트.
//
// `useApplePendingSync` hook은 mount + AppState change → 'active' 시점에 pending row를
// 처리. 본 컴포넌트가 app/_layout.tsx 전역에서 mount되어 사용자가 어느 화면에 있든
// foreground 진입 시 backlog 처리됨.
//
// DI 친화 — 모든 native 의존성(createAppleProvider, appState, fetchPreference)을 props로
// 받음. production 와이어링은 sibling component `CalendarSyncRootConnected`(app/_layout.tsx
// 또는 별도 wrapper)에서 처리.
//
// 동작:
//   1. userId 변경 시 fetchPreference 호출
//   2. preference IN ('apple_ios', 'both') 시 createAppleProvider 호출 → AppleCalendarProvider 인스턴스
//   3. 외 preference (null/'none'/'google') → apple null 유지 → hook enabled=false
//   4. createAppleProvider throw (expo-* 미설치) → silent → enabled=false 유지
//   5. fetchPreference 에러 → silent → 다음 mount/세션 재시도

import React, { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { nowKst } from '@/lib/time/kst';

import { type AppleCalendarProvider } from './apple';
import { type CalendarPreference } from './preference';
import {
  type AppStateAdapter,
  useApplePendingSync,
} from './useApplePendingSync';

// hook에 enabled=false 일 때도 형식상 필요한 stub. 실제 호출되지 않음.
const STUB_APPLE: AppleCalendarProvider = {
  providerName: 'apple_ios' as const,
  isAuthorized: async () => false,
  requestPermission: async () => {
    throw new Error('STUB_APPLE — disabled');
  },
  insertEvent: async () => {
    throw new Error('STUB_APPLE — disabled');
  },
} as unknown as AppleCalendarProvider;

export interface CalendarSyncRootProps {
  /** 로그인된 사용자 ID. undefined면 hook 비활성 + fetch skip. */
  userId: string | undefined;
  supabase: SupabaseClient;
  fetchPreference: (userId: string) => Promise<CalendarPreference | null>;
  /** production: setup.ts::createAppleCalendarProvider. Tests: jest mock. */
  createAppleProvider: () => AppleCalendarProvider;
  appState: AppStateAdapter;
  /** UPDATE completed_at에 set할 ISO 시각 생성기. default = nowKst().toUTC().toISO(). */
  now?: () => string;
}

export const CalendarSyncRoot: React.FC<CalendarSyncRootProps> = ({
  userId,
  supabase,
  fetchPreference,
  createAppleProvider,
  appState,
  now,
}) => {
  const [appleProvider, setAppleProvider] = useState<AppleCalendarProvider | null>(null);

  useEffect(() => {
    if (!userId) {
      setAppleProvider(null);
      return;
    }
    let cancelled = false;
    fetchPreference(userId)
      .then((pref) => {
        if (cancelled) return;
        if (pref === 'apple_ios' || pref === 'both') {
          try {
            setAppleProvider(createAppleProvider());
          } catch {
            // expo-calendar 미설치 — silent. 다음 EAS Build 시 활성. Google-only 사용자에게도
            // 모달 통과 후 본 분기 진입 가능성 (둘 다 선택) — 베타 한정 silent 수용.
            setAppleProvider(null);
          }
        } else {
          setAppleProvider(null);
        }
      })
      .catch(() => {
        // silent — 다음 mount(앱 재시작) 또는 사용자가 모임 확정 후 첫 모달로 preference set 시점 retry
      });
    return (): void => {
      cancelled = true;
    };
  }, [userId, fetchPreference, createAppleProvider]);

  const enabled = appleProvider !== null && Boolean(userId);

  useApplePendingSync({
    supabase,
    apple: appleProvider ?? STUB_APPLE,
    now: now ?? ((): string => nowKst().toUTC().toISO() ?? ''),
    enabled,
    appState,
  });

  return null;
};
