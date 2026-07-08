import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';
import { useKakaoInvite } from './useKakaoInvite';

const mockShare = jest.fn().mockResolvedValue({ shared: true });
jest.mock('@/lib/share/inviteShare', () => ({
  shareInviteToKakao: (...args: unknown[]) => mockShare(...args),
}));
jest.mock('@/lib/share/kakaoShare', () => ({
  createNativeShareApi: jest.fn(() => ({ share: jest.fn() })),
}));
jest.mock('@/lib/auth/setup', () => ({
  useAuth: <T>(selector: (s: { session: { user: { nickname: string } } }) => T) =>
    selector({ session: { user: { nickname: '민지' } } }),
}));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const wrapper = ({ children }: { children: React.ReactNode }): React.JSX.Element =>
  React.createElement(
    SafeAreaProvider,
    { initialMetrics: METRICS },
    React.createElement(ThemeProvider, null, React.createElement(ToastProvider, null, children)),
  );

describe('useKakaoInvite', () => {
  beforeEach(() => {
    mockShare.mockClear();
    mockShare.mockResolvedValue({ shared: true });
  });

  it('로그인 닉네임으로 shareInviteToKakao 호출', async () => {
    const { result } = renderHook(() => useKakaoInvite(), { wrapper });
    await result.current();
    expect(mockShare).toHaveBeenCalledWith(
      expect.objectContaining({ inviterNickname: '민지' }),
      expect.objectContaining({ shareApi: expect.anything() }),
    );
  });

  it('공유 실패해도 throw하지 않는다 (토스트로 처리)', async () => {
    mockShare.mockRejectedValueOnce(new Error('share failed'));
    const { result } = renderHook(() => useKakaoInvite(), { wrapper });
    await expect(result.current()).resolves.toBeUndefined();
  });
});
