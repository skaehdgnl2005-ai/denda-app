// S06-ui-reauth-modal — Google 캘린더 재인증 모달 테스트.

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { ReauthModal } from './ReauthModal';
import { ThemeProvider } from '@/design/theme';
import { CalendarProviderError } from '@/lib/calendar/google';

const wrapper = ThemeProvider;

describe('ReauthModal', () => {
  test('visible=false → 렌더되지 않음', () => {
    const { queryByTestId } = render(
      <ReauthModal visible={false} onClose={jest.fn()} signInGoogle={jest.fn()} />,
      { wrapper },
    );
    expect(queryByTestId('reauth-modal')).toBeNull();
  });

  test('visible=true → 메시지 + 다시 로그인 + 나중에 버튼', () => {
    const { getByTestId, getByText } = render(
      <ReauthModal visible={true} onClose={jest.fn()} signInGoogle={jest.fn()} />,
      { wrapper },
    );
    expect(getByTestId('reauth-modal')).toBeTruthy();
    expect(getByText('Google 캘린더 연결이 끊겼어요')).toBeTruthy();
    expect(getByTestId('reauth-button')).toBeTruthy();
    expect(getByTestId('reauth-later-button')).toBeTruthy();
  });

  test('다시 로그인 → signInGoogle 호출 + 성공 시 onSuccess + onClose', async () => {
    const onClose = jest.fn();
    const onSuccess = jest.fn();
    const signInGoogle = jest.fn().mockResolvedValue(undefined);
    const { getByTestId } = render(
      <ReauthModal
        visible={true}
        onClose={onClose}
        signInGoogle={signInGoogle}
        onSuccess={onSuccess}
      />,
      { wrapper },
    );
    await act(async () => {
      fireEvent.press(getByTestId('reauth-button'));
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(signInGoogle).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalled();
  });

  test('나중에 → onClose만 호출, signInGoogle 호출 없음', () => {
    const onClose = jest.fn();
    const signInGoogle = jest.fn();
    const { getByTestId } = render(
      <ReauthModal visible={true} onClose={onClose} signInGoogle={signInGoogle} />,
      { wrapper },
    );
    fireEvent.press(getByTestId('reauth-later-button'));
    expect(onClose).toHaveBeenCalled();
    expect(signInGoogle).not.toHaveBeenCalled();
  });

  test('cancelled → silent close (에러 메시지 표시 X, onSuccess 호출 X)', async () => {
    const onClose = jest.fn();
    const onSuccess = jest.fn();
    const signInGoogle = jest
      .fn()
      .mockRejectedValue(new CalendarProviderError({ kind: 'cancelled' }));
    const { getByTestId, queryByTestId } = render(
      <ReauthModal
        visible={true}
        onClose={onClose}
        signInGoogle={signInGoogle}
        onSuccess={onSuccess}
      />,
      { wrapper },
    );
    await act(async () => {
      fireEvent.press(getByTestId('reauth-button'));
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(queryByTestId('reauth-error-message')).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  test('unauthorized → 한국어 에러 + 모달 유지', async () => {
    const onClose = jest.fn();
    const signInGoogle = jest
      .fn()
      .mockRejectedValue(new CalendarProviderError({ kind: 'unauthorized' }));
    const { getByTestId } = render(
      <ReauthModal visible={true} onClose={onClose} signInGoogle={signInGoogle} />,
      { wrapper },
    );
    await act(async () => {
      fireEvent.press(getByTestId('reauth-button'));
    });
    await waitFor(() => {
      expect(getByTestId('reauth-error-message')).toBeTruthy();
    });
    expect(getByTestId('reauth-error-message').props.children).toMatch(/권한/);
    expect(onClose).not.toHaveBeenCalled();
  });

  test('network 에러 → 한국어 메시지 + 모달 유지', async () => {
    const onClose = jest.fn();
    const signInGoogle = jest
      .fn()
      .mockRejectedValue(new CalendarProviderError({ kind: 'network', message: 'X' }));
    const { getByTestId } = render(
      <ReauthModal visible={true} onClose={onClose} signInGoogle={signInGoogle} />,
      { wrapper },
    );
    await act(async () => {
      fireEvent.press(getByTestId('reauth-button'));
    });
    await waitFor(() => {
      expect(getByTestId('reauth-error-message')).toBeTruthy();
    });
    expect(getByTestId('reauth-error-message').props.children).toMatch(/네트워크|잠시 후/);
    expect(onClose).not.toHaveBeenCalled();
  });

  test('busy 동안 다중 press 차단', async () => {
    let resolveSignIn: () => void = () => {};
    const signInGoogle = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSignIn = resolve;
        }),
    );
    const { getByTestId } = render(
      <ReauthModal visible={true} onClose={jest.fn()} signInGoogle={signInGoogle} />,
      { wrapper },
    );
    fireEvent.press(getByTestId('reauth-button'));
    fireEvent.press(getByTestId('reauth-button'));
    fireEvent.press(getByTestId('reauth-button'));
    expect(signInGoogle).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveSignIn();
    });
  });

  test('onSuccess 미지정 시도 정상 동작 (optional callback)', async () => {
    const onClose = jest.fn();
    const signInGoogle = jest.fn().mockResolvedValue(undefined);
    const { getByTestId } = render(
      <ReauthModal visible={true} onClose={onClose} signInGoogle={signInGoogle} />,
      { wrapper },
    );
    await act(async () => {
      fireEvent.press(getByTestId('reauth-button'));
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
