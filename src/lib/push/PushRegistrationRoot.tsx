// PushRegistrationRoot — 전역 push 등록 mount 컴포넌트 (S12 마지막 wire-up).
//
// app/_layout.tsx에 mount되어 로그인된 userId 변경 시 expo-notifications
// permission + token 발급 + push_tokens UPSERT 수행. CalendarSyncRoot pattern mirror.
//
// DI 친화 — 모든 native 의존성(notifications/platform/register)을 props로 받음.
// production wiring은 sibling `PushRegistrationConnected`(app/_layout.tsx)에서 처리.
//
// 동작:
//   1. mount 시 setNotificationHandler 1회 호출 (foreground push 표시 설정)
//   2. userId 변경 시 register 호출
//   3. userId undefined → register skip (로그아웃 안전)
//   4. register throw → silent (앱 죽지 않음. 다음 mount/userId 변경 시 재시도)

import React, { useEffect, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  registerForPushNotifications as defaultRegister,
  type ExpoNotificationsApi,
  type PlatformApi,
  type RegisterArgs,
  type RegisterResult,
} from './expoNotifications';

export interface PushRegistrationRootProps {
  /** 로그인된 사용자 ID. undefined면 register skip. */
  userId: string | undefined;
  supabase: SupabaseClient;
  notifications: ExpoNotificationsApi;
  platform: PlatformApi;
  projectId: string;
  /** test 환경 DI. production default = registerForPushNotifications. */
  register?: (args: RegisterArgs) => Promise<RegisterResult>;
}

export const PushRegistrationRoot: React.FC<PushRegistrationRootProps> = ({
  userId,
  supabase,
  notifications,
  platform,
  projectId,
  register,
}) => {
  const handlerSetRef = useRef(false);
  const reg = register ?? defaultRegister;

  // setNotificationHandler 1회 (앱 부팅 직후)
  useEffect(() => {
    if (handlerSetRef.current) return;
    try {
      notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      handlerSetRef.current = true;
    } catch {
      // silent — expo-notifications 미설치 등
    }
  }, [notifications]);

  // userId 변경 → register
  useEffect(() => {
    if (!userId) return;
    reg({
      userId,
      supabase,
      notifications,
      platform,
      projectId,
    }).catch(() => {
      // silent — 다음 mount/userId 변경 시 재시도. 베타에서는 Sentry/logs로 가시화
    });
  }, [userId, supabase, notifications, platform, projectId, reg]);

  return null;
};
