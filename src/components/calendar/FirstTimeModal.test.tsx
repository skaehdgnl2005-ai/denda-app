// S06-ui-first-time-modal — 첫 모임 확정 후 캘린더 선택 모달 테스트.
//
// 책임 분리:
//   - 모달 = 옵션 4종 UI + 선택 state + 확인/나중에 버튼 + 에러 표시
//   - signInGoogle/requestApplePermission = DI (production은 setup.ts에서 wire)
//   - supabase = DI (production은 lib/supabase/client.ts singleton)
//
// 에러 정책 (CalendarProviderError.detail.kind):
//   - cancelled → silent close (DB update X, 에러 메시지 X)
//   - unauthorized → "권한이 필요해요" + 모달 유지
//   - network → "네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요" + 모달 유지
//   - 기타 → "캘린더 연결 중 오류가 발생했어요" + 모달 유지

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { FirstTimeModal } from './FirstTimeModal';
import { ThemeProvider } from '@/design/theme';
import { CalendarProviderError } from '@/lib/calendar/google';

interface SupabaseRpcChain {
  update: jest.Mock;
  eq: jest.Mock;
}

function mockSupabaseUpdate(): {
  supabase: { from: jest.Mock };
  chain: SupabaseRpcChain;
} {
  const chain: SupabaseRpcChain = {
    update: jest.fn(),
    eq: jest.fn(),
  };
  chain.update.mockReturnValue(chain);
  chain.eq.mockResolvedValue({ data: null, error: null });
  const supabase = { from: jest.fn().mockReturnValue(chain) };
  return { supabase, chain };
}

const wrapper = ThemeProvider;

describe('FirstTimeModal', () => {
  test('visible=false → 옵션 렌더되지 않음', () => {
    const { supabase } = mockSupabaseUpdate();
    const { queryByTestId } = render(
      <FirstTimeModal
        visible={false}
        onClose={jest.fn()}
        userId="u1"
        supabase={supabase as never}
        signInGoogle={jest.fn()}
        requestApplePermission={jest.fn()}
      />,
      { wrapper },
    );
    expect(queryByTestId('first-time-modal')).toBeNull();
  });

  test('visible=true → 4개 옵션 + 확인 + 나중에 버튼 렌더', () => {
    const { supabase } = mockSupabaseUpdate();
    const { getByTestId, getByText } = render(
      <FirstTimeModal
        visible={true}
        onClose={jest.fn()}
        userId="u1"
        supabase={supabase as never}
        signInGoogle={jest.fn()}
        requestApplePermission={jest.fn()}
      />,
      { wrapper },
    );
    expect(getByTestId('first-time-modal')).toBeTruthy();
    expect(getByText('어디에 추가할까요?')).toBeTruthy();
    expect(getByTestId('option-google')).toBeTruthy();
    expect(getByTestId('option-apple_ios')).toBeTruthy();
    expect(getByTestId('option-both')).toBeTruthy();
    expect(getByTestId('option-none')).toBeTruthy();
    expect(getByTestId('confirm-button')).toBeTruthy();
    expect(getByTestId('later-button')).toBeTruthy();
  });

  test('옵션 미선택 시 확인 버튼 disabled — onPress 무시', async () => {
    const { supabase } = mockSupabaseUpdate();
    const onClose = jest.fn();
    const signInGoogle = jest.fn();
    const { getByTestId } = render(
      <FirstTimeModal
        visible={true}
        onClose={onClose}
        userId="u1"
        supabase={supabase as never}
        signInGoogle={signInGoogle}
        requestApplePermission={jest.fn()}
      />,
      { wrapper },
    );
    fireEvent.press(getByTestId('confirm-button'));
    // 미선택 → 아무 콜백도 호출되지 않음
    expect(signInGoogle).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('google 선택 + 확인 → signInGoogle 호출 + users update preference=google + onClose', async () => {
    const { supabase, chain } = mockSupabaseUpdate();
    const onClose = jest.fn();
    const signInGoogle = jest.fn().mockResolvedValue(undefined);
    const requestApplePermission = jest.fn();
    const { getByTestId } = render(
      <FirstTimeModal
        visible={true}
        onClose={onClose}
        userId="u1"
        supabase={supabase as never}
        signInGoogle={signInGoogle}
        requestApplePermission={requestApplePermission}
      />,
      { wrapper },
    );
    fireEvent.press(getByTestId('option-google'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-button'));
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(signInGoogle).toHaveBeenCalledTimes(1);
    expect(requestApplePermission).not.toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledWith('users');
    expect(chain.update).toHaveBeenCalledWith({ calendar_preference: 'google' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'u1');
  });

  test('apple_ios 선택 + 확인 → requestApplePermission 호출 + users update preference=apple_ios + onClose', async () => {
    const { supabase, chain } = mockSupabaseUpdate();
    const onClose = jest.fn();
    const signInGoogle = jest.fn();
    const requestApplePermission = jest.fn().mockResolvedValue(undefined);
    const { getByTestId } = render(
      <FirstTimeModal
        visible={true}
        onClose={onClose}
        userId="u1"
        supabase={supabase as never}
        signInGoogle={signInGoogle}
        requestApplePermission={requestApplePermission}
      />,
      { wrapper },
    );
    fireEvent.press(getByTestId('option-apple_ios'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-button'));
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(signInGoogle).not.toHaveBeenCalled();
    expect(requestApplePermission).toHaveBeenCalledTimes(1);
    expect(chain.update).toHaveBeenCalledWith({ calendar_preference: 'apple_ios' });
  });

  test('both 선택 + 확인 → 두 provider 모두 호출 + users update preference=both + onClose', async () => {
    const { supabase, chain } = mockSupabaseUpdate();
    const onClose = jest.fn();
    const signInGoogle = jest.fn().mockResolvedValue(undefined);
    const requestApplePermission = jest.fn().mockResolvedValue(undefined);
    const { getByTestId } = render(
      <FirstTimeModal
        visible={true}
        onClose={onClose}
        userId="u1"
        supabase={supabase as never}
        signInGoogle={signInGoogle}
        requestApplePermission={requestApplePermission}
      />,
      { wrapper },
    );
    fireEvent.press(getByTestId('option-both'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-button'));
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(signInGoogle).toHaveBeenCalledTimes(1);
    expect(requestApplePermission).toHaveBeenCalledTimes(1);
    expect(chain.update).toHaveBeenCalledWith({ calendar_preference: 'both' });
  });

  test('none 선택 + 확인 → provider 호출 없음 + users update preference=none + onClose', async () => {
    const { supabase, chain } = mockSupabaseUpdate();
    const onClose = jest.fn();
    const signInGoogle = jest.fn();
    const requestApplePermission = jest.fn();
    const { getByTestId } = render(
      <FirstTimeModal
        visible={true}
        onClose={onClose}
        userId="u1"
        supabase={supabase as never}
        signInGoogle={signInGoogle}
        requestApplePermission={requestApplePermission}
      />,
      { wrapper },
    );
    fireEvent.press(getByTestId('option-none'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-button'));
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(signInGoogle).not.toHaveBeenCalled();
    expect(requestApplePermission).not.toHaveBeenCalled();
    expect(chain.update).toHaveBeenCalledWith({ calendar_preference: 'none' });
  });

  test('나중에 버튼 → onClose 호출, DB update 없음', () => {
    const { supabase } = mockSupabaseUpdate();
    const onClose = jest.fn();
    const signInGoogle = jest.fn();
    const { getByTestId } = render(
      <FirstTimeModal
        visible={true}
        onClose={onClose}
        userId="u1"
        supabase={supabase as never}
        signInGoogle={signInGoogle}
        requestApplePermission={jest.fn()}
      />,
      { wrapper },
    );
    fireEvent.press(getByTestId('later-button'));
    expect(onClose).toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(signInGoogle).not.toHaveBeenCalled();
  });

  test('google cancelled → silent close (DB update X, 에러 메시지 X)', async () => {
    const { supabase } = mockSupabaseUpdate();
    const onClose = jest.fn();
    const signInGoogle = jest
      .fn()
      .mockRejectedValue(new CalendarProviderError({ kind: 'cancelled' }));
    const { getByTestId, queryByTestId } = render(
      <FirstTimeModal
        visible={true}
        onClose={onClose}
        userId="u1"
        supabase={supabase as never}
        signInGoogle={signInGoogle}
        requestApplePermission={jest.fn()}
      />,
      { wrapper },
    );
    fireEvent.press(getByTestId('option-google'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-button'));
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    // DB update가 호출되지 않아야 함 (cancelled = 사용자 의도 X)
    expect(supabase.from).not.toHaveBeenCalled();
    // 에러 메시지 표시되지 않아야 함
    expect(queryByTestId('error-message')).toBeNull();
  });

  test('apple_ios unauthorized → 한국어 에러 메시지 + 모달 유지 + DB update 없음', async () => {
    const { supabase } = mockSupabaseUpdate();
    const onClose = jest.fn();
    const requestApplePermission = jest
      .fn()
      .mockRejectedValue(new CalendarProviderError({ kind: 'unauthorized' }));
    const { getByTestId } = render(
      <FirstTimeModal
        visible={true}
        onClose={onClose}
        userId="u1"
        supabase={supabase as never}
        signInGoogle={jest.fn()}
        requestApplePermission={requestApplePermission}
      />,
      { wrapper },
    );
    fireEvent.press(getByTestId('option-apple_ios'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-button'));
    });
    await waitFor(() => {
      expect(getByTestId('error-message')).toBeTruthy();
    });
    const errMsg = getByTestId('error-message');
    expect(errMsg.props.children).toMatch(/권한/);
    expect(onClose).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('google network 에러 → 한국어 메시지 + 모달 유지', async () => {
    const { supabase } = mockSupabaseUpdate();
    const onClose = jest.fn();
    const signInGoogle = jest
      .fn()
      .mockRejectedValue(new CalendarProviderError({ kind: 'network', message: 'ETIMEDOUT' }));
    const { getByTestId } = render(
      <FirstTimeModal
        visible={true}
        onClose={onClose}
        userId="u1"
        supabase={supabase as never}
        signInGoogle={signInGoogle}
        requestApplePermission={jest.fn()}
      />,
      { wrapper },
    );
    fireEvent.press(getByTestId('option-google'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-button'));
    });
    await waitFor(() => {
      expect(getByTestId('error-message')).toBeTruthy();
    });
    expect(getByTestId('error-message').props.children).toMatch(/네트워크|잠시 후/);
    expect(onClose).not.toHaveBeenCalled();
  });

  test('확인 처리 중에는 confirm-button busy 표시 (다중 호출 차단)', async () => {
    const { supabase } = mockSupabaseUpdate();
    let resolveSignIn: () => void = () => {};
    const signInGoogle = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSignIn = resolve;
        }),
    );
    const { getByTestId } = render(
      <FirstTimeModal
        visible={true}
        onClose={jest.fn()}
        userId="u1"
        supabase={supabase as never}
        signInGoogle={signInGoogle}
        requestApplePermission={jest.fn()}
      />,
      { wrapper },
    );
    fireEvent.press(getByTestId('option-google'));
    fireEvent.press(getByTestId('confirm-button'));

    // busy 상태에서 두 번째 press는 무시되어야 함
    fireEvent.press(getByTestId('confirm-button'));
    expect(signInGoogle).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSignIn();
    });
  });

  test('supabase update 에러 → 한국어 메시지 표시 + 모달 유지 (provider 성공 후 DB 실패 시)', async () => {
    const chain: SupabaseRpcChain = {
      update: jest.fn(),
      eq: jest.fn(),
    };
    chain.update.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ data: null, error: { message: 'DB perm denied' } });
    const supabase = { from: jest.fn().mockReturnValue(chain) };

    const onClose = jest.fn();
    const signInGoogle = jest.fn().mockResolvedValue(undefined);
    const { getByTestId } = render(
      <FirstTimeModal
        visible={true}
        onClose={onClose}
        userId="u1"
        supabase={supabase as never}
        signInGoogle={signInGoogle}
        requestApplePermission={jest.fn()}
      />,
      { wrapper },
    );
    fireEvent.press(getByTestId('option-google'));
    await act(async () => {
      fireEvent.press(getByTestId('confirm-button'));
    });
    await waitFor(() => {
      expect(getByTestId('error-message')).toBeTruthy();
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
