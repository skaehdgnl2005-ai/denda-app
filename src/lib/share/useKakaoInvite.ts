// useKakaoInvite — 카톡 친구 초대 공유를 한 곳에 모은 훅 (W1-15).
// friends/index(빈 상태 CTA)와 friends/search(카톡 초대 카드)가 동일 로직을 공유한다.
// 시스템 share sheet를 띄우고(사용자가 카톡 선택), 실패는 mapError로 친절한 토스트 —
// 취소류(사용자가 공유 시트를 닫음)는 silent.
import { useCallback } from 'react';

import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/auth/setup';
import { mapError } from '@/lib/i18n/messages';
import { shareInviteToKakao } from '@/lib/share/inviteShare';
import { createNativeShareApi } from '@/lib/share/kakaoShare';

export function useKakaoInvite(): () => Promise<void> {
  const toast = useToast();
  const inviterNickname = useAuth((s) => s.session?.user.nickname ?? '');

  return useCallback(async () => {
    try {
      await shareInviteToKakao({ inviterNickname }, { shareApi: createNativeShareApi() });
    } catch (e) {
      const { silent, message } = mapError(e);
      if (!silent) toast.show({ message, variant: 'error' });
    }
  }, [inviterNickname, toast]);
}
