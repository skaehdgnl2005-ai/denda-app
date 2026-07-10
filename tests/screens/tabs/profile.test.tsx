import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ProfileScreen from '../../../app/(tabs)/profile';
import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';
import { router } from 'expo-router';
import { isGoogleReauthNeeded } from '@/lib/calendar/reauth';

// ConfirmSheet·Toast가 useSafeAreaInsets를 쓰므로 SafeAreaProvider(initialMetrics) 필수.
// useToast는 ToastProvider 안에서만 동작.
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const wrapper = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  </SafeAreaProvider>
);

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: (...args: unknown[]) => mockReplace(...args) },
}));

const mockSignOut = jest.fn().mockResolvedValue(undefined);
const mockReset = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/auth/setup', () => ({
  useAuth: <T,>(selector: (s: { session: { user: { id: string; nickname: string } } }) => T) =>
    selector({ session: { user: { id: 'user-1', nickname: '민지' } } }),
  authStore: {
    getState: () => ({
      signOut: () => mockSignOut(),
      resetForAccountDeletion: () => mockReset(),
    }),
  },
}));

const mockDeleteAccount = jest.fn();
jest.mock('@/lib/auth/deleteAccount', () => ({
  deleteAccount: () => mockDeleteAccount(),
}));

const mockClearGoogleToken = jest.fn().mockResolvedValue(undefined);

// S06 reauth helpers — false 반환으로 ReauthModal 미노출.
jest.mock('@/lib/calendar/reauth', () => ({
  isGoogleReauthNeeded: jest.fn().mockResolvedValue(false),
}));
jest.mock('@/lib/calendar/setup', () => ({
  createGoogleCalendarProvider: jest.fn(),
  signInGoogleAndUpload: jest.fn(),
  clearStoredGoogleToken: () => mockClearGoogleToken(),
}));
jest.mock('@/lib/supabase/client', () => ({
  supabase: { rpc: jest.fn().mockResolvedValue({ data: null, error: null }) },
}));

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteAccount.mockReset();
  });

  describe('준비/정보 행 — 비대화형 (W1-4~6 죽은 Alert 제거)', () => {
    test('알림·화면모드·신고차단 행이 렌더되고 대화형 버튼이 아니다', async () => {
      const { getByTestId } = render(<ProfileScreen />, { wrapper });
      await waitFor(() => expect(getByTestId('notifications-row')).toBeTruthy());
      expect(getByTestId('theme-row')).toBeTruthy();
      expect(getByTestId('reports-row')).toBeTruthy();
      // 비대화형 → accessibilityRole=button 아님(누를 것 없음, Alert 서프라이즈 제거)
      expect(getByTestId('notifications-row').props.accessibilityRole).toBeUndefined();
      expect(getByTestId('theme-row').props.accessibilityRole).toBeUndefined();
      expect(getByTestId('reports-row').props.accessibilityRole).toBeUndefined();
    });

    test('에브리타임 import 행은 여전히 대화형(route) — 회귀 방지', async () => {
      const { getByTestId } = render(<ProfileScreen />, { wrapper });
      await waitFor(() => expect(getByTestId('everytime-import-link')).toBeTruthy());
      expect(getByTestId('everytime-import-link').props.accessibilityRole).toBe('button');
    });
  });

  describe('로그아웃 (회귀)', () => {
    test('로그아웃 → signOut + 스플래시 replace', async () => {
      const { getByTestId } = render(<ProfileScreen />, { wrapper });
      await waitFor(() => expect(getByTestId('signout-button')).toBeTruthy());
      await act(async () => {
        fireEvent.press(getByTestId('signout-button'));
      });
      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledTimes(1);
        expect(mockReplace).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('W1-14 회원 탈퇴', () => {
    test('관리 섹션에 회원 탈퇴 행 렌더 (destructive)', async () => {
      const { getByTestId } = render(<ProfileScreen />, { wrapper });
      await waitFor(() => expect(getByTestId('delete-account-button')).toBeTruthy());
      expect(getByTestId('delete-account-button').props.accessibilityRole).toBe('button');
    });

    test('탈퇴 행 탭 → 1단 시트(경고 + 모임 삭제 고지), 아직 삭제 안 함', async () => {
      const { getByTestId, getByText } = render(<ProfileScreen />, { wrapper });
      await waitFor(() => expect(getByTestId('delete-account-button')).toBeTruthy());
      fireEvent.press(getByTestId('delete-account-button'));
      expect(getByText('정말 탈퇴하시겠어요?')).toBeTruthy();
      expect(getByText(/모임과 그 안의 투표/)).toBeTruthy();
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    test('1단 확정 → 2단(마지막 확인) 시트, 아직 삭제 안 함', async () => {
      const { getByTestId, getByText } = render(<ProfileScreen />, { wrapper });
      await waitFor(() => expect(getByTestId('delete-account-button')).toBeTruthy());
      fireEvent.press(getByTestId('delete-account-button'));
      fireEvent.press(getByTestId('delete-account-sheet-confirm'));
      expect(getByText('마지막 확인이에요')).toBeTruthy();
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    test('2단 확정 성공 → deleteAccount + resetForAccountDeletion + 스플래시 replace', async () => {
      mockDeleteAccount.mockResolvedValue(undefined);
      const { getByTestId } = render(<ProfileScreen />, { wrapper });
      await waitFor(() => expect(getByTestId('delete-account-button')).toBeTruthy());
      fireEvent.press(getByTestId('delete-account-button'));
      fireEvent.press(getByTestId('delete-account-sheet-confirm')); // 1단 → 2단
      await act(async () => {
        fireEvent.press(getByTestId('delete-account-sheet-confirm')); // 2단 → 삭제
      });
      await waitFor(() => {
        expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
        expect(mockReset).toHaveBeenCalledTimes(1);
        // 로컬 Google 토큰(제3자 자격증명)도 기기에서 정리
        expect(mockClearGoogleToken).toHaveBeenCalledTimes(1);
        expect(mockReplace).toHaveBeenCalledWith('/');
      });
    });

    test('삭제 실패 → 에러 토스트, teardown/replace 미호출', async () => {
      mockDeleteAccount.mockRejectedValue(
        new Error('회원 탈퇴에 실패했어요. 잠시 후 다시 시도해주세요.'),
      );
      const { getByTestId, findByText } = render(<ProfileScreen />, { wrapper });
      await waitFor(() => expect(getByTestId('delete-account-button')).toBeTruthy());
      fireEvent.press(getByTestId('delete-account-button'));
      fireEvent.press(getByTestId('delete-account-sheet-confirm')); // 1단 → 2단
      await act(async () => {
        fireEvent.press(getByTestId('delete-account-sheet-confirm')); // 2단 → 삭제(실패)
      });
      expect(await findByText(/회원 탈퇴에 실패했어요/)).toBeTruthy();
      expect(mockReset).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    test('1단에서 취소 → deleteAccount 미호출, navigation 없음', async () => {
      const { getByTestId } = render(<ProfileScreen />, { wrapper });
      await waitFor(() => expect(getByTestId('delete-account-button')).toBeTruthy());
      fireEvent.press(getByTestId('delete-account-button'));
      fireEvent.press(getByTestId('delete-account-sheet-cancel'));
      expect(mockDeleteAccount).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe('W2-11 캘린더 연결 행 + 재진입', () => {
    test('연결 끊김 → 끊김 행 노출 + 나중에 닫아도 행에서 재연결(재진입)', async () => {
      (isGoogleReauthNeeded as jest.Mock).mockResolvedValueOnce(true);
      const { getByTestId, queryByTestId } = render(<ProfileScreen />, { wrapper });

      // 마운트 시 모달 자동 노출(기존 auto-open 동작 유지)
      await waitFor(() => expect(getByTestId('reauth-modal')).toBeTruthy());

      // '나중에'로 닫으면 모달은 사라진다
      await act(async () => {
        fireEvent.press(getByTestId('reauth-later-button'));
      });
      await waitFor(() => expect(queryByTestId('reauth-modal')).toBeNull());

      // 끊김 상태는 영구 행으로 남는다 — 색 단독 아님(§12.6 연결 끊김 뱃지 + 경고 아이콘)
      expect(getByTestId('calendar-disconnected-badge')).toBeTruthy();

      // 행을 다시 누르면 모달 재진입 (나중에 닫아도 재연결 경로 존재)
      await act(async () => {
        fireEvent.press(getByTestId('calendar-connection-row'));
      });
      await waitFor(() => expect(getByTestId('reauth-modal')).toBeTruthy());
    });

    test('연결됨(기본) → 일반 행, 모달 자동 노출 안 함, 끊김 뱃지 없음', async () => {
      const { getByTestId, queryByTestId } = render(<ProfileScreen />, { wrapper });
      await waitFor(() => expect(getByTestId('calendar-connection-row')).toBeTruthy());
      expect(queryByTestId('reauth-modal')).toBeNull();
      expect(queryByTestId('calendar-disconnected-badge')).toBeNull();
    });
  });

  describe('W2-11 약관·정보 링크', () => {
    test('이용약관 → legal(doc:service), 개인정보 → privacy 라우팅', async () => {
      const { getByTestId } = render(<ProfileScreen />, { wrapper });
      await waitFor(() => expect(getByTestId('terms-of-service-link')).toBeTruthy());

      fireEvent.press(getByTestId('terms-of-service-link'));
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/(auth)/legal',
        params: { doc: 'service' },
      });

      fireEvent.press(getByTestId('privacy-policy-link'));
      expect(router.push).toHaveBeenCalledWith('/(auth)/privacy');
    });
  });

  describe('W2-11 회귀 — 기존 행 유지', () => {
    test('회원탈퇴·에브리타임·로그아웃 행 그대로', async () => {
      const { getByTestId } = render(<ProfileScreen />, { wrapper });
      await waitFor(() => expect(getByTestId('delete-account-button')).toBeTruthy());
      expect(getByTestId('everytime-import-link')).toBeTruthy();
      expect(getByTestId('signout-button')).toBeTruthy();
    });
  });
});
