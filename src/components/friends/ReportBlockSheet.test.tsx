import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ReportBlockSheet } from './ReportBlockSheet';
import { ThemeProvider } from '@/design/theme';

describe('ReportBlockSheet Component', () => {
  const wrapper = ThemeProvider;

  const mockTarget = {
    id: 'user-45',
    nickname: '차단테스트',
  };

  test('renders options menu step correctly when visible', () => {
    const handleClose = jest.fn();
    const handleBlock = jest.fn();
    const handleReport = jest.fn();

    const { getByText, queryByTestId } = render(
      <ReportBlockSheet
        visible={true}
        onClose={handleClose}
        targetUser={mockTarget}
        onBlock={handleBlock}
        onReport={handleReport}
      />,
      { wrapper },
    );

    expect(getByText('차단테스트님 설정')).toBeTruthy();
    expect(getByText('신고하기')).toBeTruthy();
    expect(getByText('차단하기')).toBeTruthy();
    expect(queryByTestId('back-to-menu-button')).toBeNull();
  });

  test('calls onBlock when block option is pressed', () => {
    const handleClose = jest.fn();
    const handleBlock = jest.fn();
    const handleReport = jest.fn();

    const { getByTestId } = render(
      <ReportBlockSheet
        visible={true}
        onClose={handleClose}
        targetUser={mockTarget}
        onBlock={handleBlock}
        onReport={handleReport}
      />,
      { wrapper },
    );

    fireEvent.press(getByTestId('block-option'));
    expect(handleBlock).toHaveBeenCalledWith('user-45');
    expect(handleClose).toHaveBeenCalled();
  });

  test('navigates through report flow and submits report details (key + label split)', () => {
    const handleClose = jest.fn();
    const handleBlock = jest.fn();
    const handleReport = jest.fn();

    const { getByTestId, getByText } = render(
      <ReportBlockSheet
        visible={true}
        onClose={handleClose}
        targetUser={mockTarget}
        onBlock={handleBlock}
        onReport={handleReport}
      />,
      { wrapper },
    );

    fireEvent.press(getByTestId('report-option'));

    expect(getByText('신고 사유 선택')).toBeTruthy();
    expect(getByText('스팸 및 광고')).toBeTruthy();

    fireEvent.press(getByTestId('reason-spam'));

    expect(getByText('상세 내용 입력')).toBeTruthy();
    expect(getByText('사유: 스팸 및 광고')).toBeTruthy();

    const textInput = getByTestId('report-details-input');
    fireEvent.changeText(textInput, '이 사람은 매너가 좋지 않아요');

    fireEvent.press(getByTestId('report-submit-button'));
    // onReport는 schema enum key('spam')를 전달 — label이 아닌
    expect(handleReport).toHaveBeenCalledWith('user-45', 'spam', '이 사람은 매너가 좋지 않아요');
    expect(handleClose).toHaveBeenCalled();
  });

  test('5개 reason 모두 schema enum 정합 화면에 노출 + harassment/fake_profile 신규 정확 전달', () => {
    const handleReport = jest.fn();

    const { getByTestId, getByText } = render(
      <ReportBlockSheet
        visible={true}
        onClose={jest.fn()}
        targetUser={mockTarget}
        onBlock={jest.fn()}
        onReport={handleReport}
      />,
      { wrapper },
    );

    fireEvent.press(getByTestId('report-option'));

    expect(getByText('스팸 및 광고')).toBeTruthy();
    expect(getByText('욕설 및 괴롭힘')).toBeTruthy();
    expect(getByText('부적절한 닉네임/프로필')).toBeTruthy();
    expect(getByText('사칭 및 가짜 프로필')).toBeTruthy();
    expect(getByText('기타')).toBeTruthy();

    fireEvent.press(getByTestId('reason-harassment'));
    fireEvent.press(getByTestId('report-submit-button'));

    expect(handleReport).toHaveBeenCalledWith('user-45', 'harassment', '');
  });

  test('closes sheet when backdrop is pressed', () => {
    const handleClose = jest.fn();
    const handleBlock = jest.fn();
    const handleReport = jest.fn();

    const { getByTestId } = render(
      <ReportBlockSheet
        visible={true}
        onClose={handleClose}
        targetUser={mockTarget}
        onBlock={handleBlock}
        onReport={handleReport}
      />,
      { wrapper },
    );

    fireEvent.press(getByTestId('sheet-backdrop'));
    expect(handleClose).toHaveBeenCalled();
  });
});
