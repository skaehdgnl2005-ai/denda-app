// S15-deeplink-rn-conversion — 자체 deferred deep link 전역 wire-up.
//
// 앱 첫 launch + 로그인 직후 1회:
//   1. resolveAttribution(supabase, {mode:'fingerprint'}) 시도 (server 측 IP+UA hash 매칭)
//   2. matched=true → onMatched(groupId) callback (외부에서 toast 또는 list refresh)
//   3. matched=false 또는 throw → InviteCodeModal 표시 (4자리 invite_code fallback)
//
// Dedup 2단:
//   1. in-memory ref — 같은 mount 안에서 re-render 시 중복 호출 방지
//   2. SecureStore 플래그 — 앱 재시작(콜드 스타트) 후에도 유지. ref만으로는 프로세스가 죽을 때
//      초기화되어 실행할 때마다 fingerprint miss → 모달이 다시 뜬다. attribution은 "앱 첫 실행"
//      1회 이벤트이므로(ARCHITECTURE §W0+δ) 영속 플래그가 진짜 게이트. attTracking.ts와 동일 패턴.
// userId 변경(다른 계정 로그인) 시에는 새 사용자로 간주해 다시 시도.
//
// DI 친화:
//   - resolve: production = (args) => resolveAttribution(supabase, args)
//   - onMatched: 모임 list refresh + 한국어 toast (외부 wire)
//   - storage: production = expo-secure-store

import React, { useEffect, useRef, useState } from 'react';

import { InviteCodeModal } from '@/components/attribution/InviteCodeModal';
import type { ResolveArgs, ResolveResult } from './attributionApi';

/** 값 = attribution을 이미 시도한 userId. */
export const ATTRIBUTION_ATTEMPT_KEY = 'denda_attribution_attempted_v1';

export interface AttributionStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

export interface AttributionRootProps {
  /** 로그인된 사용자 ID. undefined면 attribution 시도 안 함. */
  userId: string | undefined;
  resolve: (args: ResolveArgs) => Promise<ResolveResult>;
  /** matched=true (fingerprint or invite_code) → 모임 list refresh 등. */
  onMatched: (groupId: string) => void;
  /** 콜드 스타트 간 1회 보장용 영속 저장소. production = expo-secure-store. */
  storage: AttributionStorage;
}

export const AttributionRoot: React.FC<AttributionRootProps> = ({
  userId,
  resolve,
  onMatched,
  storage,
}) => {
  const [showModal, setShowModal] = useState(false);
  const attemptedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      // 로그아웃 시 reset — 다음 사용자 변경 시 시도 가능
      attemptedForUserRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowModal(false);
      return;
    }
    if (attemptedForUserRef.current === userId) {
      // 같은 사용자에 대해 이미 시도 — skip
      return;
    }
    attemptedForUserRef.current = userId;

    let cancelled = false;

    const run = async (): Promise<void> => {
      try {
        const attemptedUserId = await storage.getItemAsync(ATTRIBUTION_ATTEMPT_KEY);
        if (attemptedUserId === userId) return; // 이전 launch에서 이미 시도 — 모달 재노출 금지
      } catch {
        // 저장소 접근 실패 — best-effort로 진행(mount lifetime dedup으로 degrade).
      }
      if (cancelled) return;

      // resolve 전에 기록 — 네트워크 실패·강제 종료로 흐름이 끊겨도 다음 launch에 다시 뜨지 않는다.
      try {
        await storage.setItemAsync(ATTRIBUTION_ATTEMPT_KEY, userId);
      } catch {
        // write 실패도 silent — 다음 launch에 한 번 더 시도될 뿐.
      }
      if (cancelled) return;

      try {
        const res = await resolve({ mode: 'fingerprint' });
        if (cancelled) return;
        if (res.matched) {
          onMatched(res.groupId);
        } else {
          setShowModal(true);
        }
      } catch {
        // fingerprint 매칭 실패는 silent — invite_code fallback 모달로 진입
        if (!cancelled) setShowModal(true);
      }
    };

    void run();

    return (): void => {
      cancelled = true;
    };
  }, [userId, resolve, onMatched, storage]);

  const handleSuccess = (groupId: string): void => {
    setShowModal(false);
    onMatched(groupId);
  };

  const handleSkip = (): void => {
    setShowModal(false);
  };

  return (
    <InviteCodeModal
      visible={showModal}
      onSuccess={handleSuccess}
      onSkip={handleSkip}
      resolve={resolve}
    />
  );
};
