import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { InviteCodeModal } from './InviteCodeModal';
import { ThemeProvider } from '@/design/theme';

const VALID_GROUP_ID = '11111111-1111-1111-1111-111111111111';

describe('InviteCodeModal', () => {
  const onSuccessMock = jest.fn();
  const onSkipMock = jest.fn();
  const resolveMock = jest.fn();

  beforeEach(() => {
    onSuccessMock.mockReset();
    onSkipMock.mockReset();
    resolveMock.mockReset();
  });

  function renderModal(visible = true) {
    return render(
      <InviteCodeModal
        visible={visible}
        onSuccess={onSuccessMock}
        onSkip={onSkipMock}
        resolve={resolveMock}
      />,
      { wrapper: ThemeProvider },
    );
  }

  it('visible=false면 렌더 안 됨', () => {
    const { queryByTestId } = renderModal(false);
    expect(queryByTestId('invite-code-modal')).toBeNull();
  });

  it('초기 상태: 확인 버튼 disabled (코드 0자리)', () => {
    const { getByTestId } = renderModal();
    const confirm = getByTestId('invite-code-confirm');
    expect(confirm.props.accessibilityState?.disabled).toBe(true);
  });

  it('4자리 numeric 입력 시 확인 활성화', () => {
    const { getByTestId } = renderModal();
    fireEvent.changeText(getByTestId('invite-code-input'), '0042');
    expect(getByTestId('invite-code-confirm').props.accessibilityState?.disabled).toBe(false);
  });

  it('3자리 입력 시 확인 비활성 유지', () => {
    const { getByTestId } = renderModal();
    fireEvent.changeText(getByTestId('invite-code-input'), '123');
    expect(getByTestId('invite-code-confirm').props.accessibilityState?.disabled).toBe(true);
  });

  it('non-numeric 문자는 입력 무시 (4자리 numeric만)', () => {
    const { getByTestId } = renderModal();
    const input = getByTestId('invite-code-input');
    fireEvent.changeText(input, 'ab12');
    expect(input.props.value).toBe('12');
  });

  it('5자리 초과 입력은 4자리에서 truncate', () => {
    const { getByTestId } = renderModal();
    const input = getByTestId('invite-code-input');
    fireEvent.changeText(input, '12345');
    expect(input.props.value).toBe('1234');
  });

  it('확인 → resolve 호출 + matched=true 시 onSuccess(groupId, guestToken)', async () => {
    resolveMock.mockResolvedValue({
      matched: true,
      groupId: VALID_GROUP_ID,
      guestToken: null,
    });
    const { getByTestId } = renderModal();
    fireEvent.changeText(getByTestId('invite-code-input'), '0042');
    fireEvent.press(getByTestId('invite-code-confirm'));
    await waitFor(() => {
      expect(resolveMock).toHaveBeenCalledWith({ mode: 'invite_code', code: '0042' });
      expect(onSuccessMock).toHaveBeenCalledWith(VALID_GROUP_ID, null);
    });
  });

  it('matched=false 시 에러 메시지 노출 + onSuccess 미호출', async () => {
    resolveMock.mockResolvedValue({ matched: false });
    const { getByTestId, findByText } = renderModal();
    fireEvent.changeText(getByTestId('invite-code-input'), '0042');
    fireEvent.press(getByTestId('invite-code-confirm'));
    await findByText(/해당 코드의 모임을 찾지 못했어요/);
    expect(onSuccessMock).not.toHaveBeenCalled();
  });

  it('resolve throw → 한국어 에러 메시지', async () => {
    resolveMock.mockRejectedValue(new Error('모임 합류에 실패했어요. 잠시 후 다시 시도해주세요.'));
    const { getByTestId, findByText } = renderModal();
    fireEvent.changeText(getByTestId('invite-code-input'), '0042');
    fireEvent.press(getByTestId('invite-code-confirm'));
    await findByText(/모임 합류에 실패/);
  });

  it('건너뛰기 → onSkip 호출, resolve 미호출', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(((
      _title: string,
      _message?: string,
      buttons?: readonly { text: string; onPress?: () => void }[],
    ) => {
      const yes = buttons?.find((b) => b.text === '건너뛰기');
      yes?.onPress?.();
    }) as typeof Alert.alert);
    const { getByTestId } = renderModal();
    fireEvent.press(getByTestId('invite-code-skip'));
    expect(resolveMock).not.toHaveBeenCalled();
    expect(onSkipMock).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('건너뛰기 Alert cancel 시 onSkip 미호출', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(((
      _title: string,
      _message?: string,
      buttons?: readonly { text: string; onPress?: () => void }[],
    ) => {
      const cancel = buttons?.find((b) => b.text === '취소');
      cancel?.onPress?.();
    }) as typeof Alert.alert);
    const { getByTestId } = renderModal();
    fireEvent.press(getByTestId('invite-code-skip'));
    expect(onSkipMock).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
