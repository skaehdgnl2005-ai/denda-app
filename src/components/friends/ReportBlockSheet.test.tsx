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
      { wrapper }
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
      { wrapper }
    );

    fireEvent.press(getByTestId('block-option'));
    expect(handleBlock).toHaveBeenCalledWith('user-45');
    expect(handleClose).toHaveBeenCalled();
  });

  test('navigates through report flow and submits report details', () => {
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
      { wrapper }
    );

    // 1. Click Report
    fireEvent.press(getByTestId('report-option'));

    // 2. We should see the reason screen
    expect(getByText('신고 사유 선택')).toBeTruthy();
    expect(getByText('스팸 및 광고')).toBeTruthy();

    // 3. Choose a reason
    fireEvent.press(getByTestId('reason-spam'));

    // 4. We should see detail screen
    expect(getByText('상세 내용 입력')).toBeTruthy();
    expect(getByText('사유: 스팸 및 광고')).toBeTruthy();

    // 5. Enter details
    const textInput = getByTestId('report-details-input');
    fireEvent.changeText(textInput, '이 사람은 매너가 좋지 않아요');

    // 6. Submit
    fireEvent.press(getByTestId('report-submit-button'));
    expect(handleReport).toHaveBeenCalledWith(
      'user-45',
      '스팸 및 광고',
      '이 사람은 매너가 좋지 않아요'
    );
    expect(handleClose).toHaveBeenCalled();
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
      { wrapper }
    );

    fireEvent.press(getByTestId('sheet-backdrop'));
    expect(handleClose).toHaveBeenCalled();
  });
});
