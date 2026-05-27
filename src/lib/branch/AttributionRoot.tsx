// S15-deeplink-rn-conversion — 자체 deferred deep link 전역 wire-up.
//
// 앱 첫 launch + 로그인 직후 1회:
//   1. resolveAttribution(supabase, {mode:'fingerprint'}) 시도 (server 측 IP+UA hash 매칭)
//   2. matched=true → onMatched(groupId) callback (외부에서 toast 또는 list refresh)
//   3. matched=false 또는 throw → InviteCodeModal 표시 (4자리 invite_code fallback)
//
// In-memory dedup: 같은 userId 동안 resolve 1회만 호출. userId 변경(로그아웃→재로그인) 시
// 다시 시도. 영구 persistence는 후속 sub-task(AsyncStorage). 현재는 mount lifetime 한정.
//
// DI 친화:
//   - resolve: production = (args) => resolveAttribution(supabase, args)
//   - onMatched: 모임 list refresh + 한국어 toast (외부 wire)

import React, { useEffect, useRef, useState } from 'react';

import { InviteCodeModal } from '@/components/attribution/InviteCodeModal';
import type { ResolveArgs, ResolveResult } from './attributionApi';

export interface AttributionRootProps {
  /** 로그인된 사용자 ID. undefined면 attribution 시도 안 함. */
  userId: string | undefined;
  resolve: (args: ResolveArgs) => Promise<ResolveResult>;
  /** matched=true (fingerprint or invite_code) → 모임 list refresh 등. */
  onMatched: (groupId: string) => void;
}

export const AttributionRoot: React.FC<AttributionRootProps> = ({ userId, resolve, onMatched }) => {
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
    resolve({ mode: 'fingerprint' })
      .then((res) => {
        if (cancelled) return;
        if (res.matched) {
          onMatched(res.groupId);
        } else {
          setShowModal(true);
        }
      })
      .catch(() => {
        // fingerprint 매칭 실패는 silent — invite_code fallback 모달로 진입
        if (!cancelled) setShowModal(true);
      });

    return (): void => {
      cancelled = true;
    };
  }, [userId, resolve, onMatched]);

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
