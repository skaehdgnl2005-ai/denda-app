// NicknameField — 가입 화면과 수정 화면이 공유하는 입력 컴포넌트.
// 스펙: docs/superpowers/specs/2026-07-29-nickname-design.md §7.

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { NicknameField } from './NicknameField';
import { ThemeProvider } from '@/design/theme';

const wrapper = ThemeProvider;

describe('NicknameField', () => {
  test('값과 힌트를 렌더한다', () => {
    const { getByTestId, getByText } = render(
      <NicknameField value="민수" onChangeText={jest.fn()} />,
      { wrapper },
    );

    expect(getByTestId('nickname-input').props.value).toBe('민수');
    expect(getByText('한글·영문·숫자·밑줄 2~12자')).toBeTruthy();
  });

  test('입력 시 onChangeText 호출', () => {
    const onChangeText = jest.fn();
    const { getByTestId } = render(<NicknameField value="" onChangeText={onChangeText} />, {
      wrapper,
    });

    fireEvent.changeText(getByTestId('nickname-input'), '민수');

    expect(onChangeText).toHaveBeenCalledWith('민수');
  });

  test('error가 있으면 힌트 대신 에러를 보여준다', () => {
    const { getByText, queryByText } = render(
      <NicknameField value="가" onChangeText={jest.fn()} error="2자 이상 입력해주세요" />,
      { wrapper },
    );

    expect(getByText('2자 이상 입력해주세요')).toBeTruthy();
    // 힌트와 에러를 동시에 띄우면 어느 쪽을 따라야 할지 모호해진다
    expect(queryByText('한글·영문·숫자·밑줄 2~12자')).toBeNull();
  });

  test('에러는 색 단독이 아니라 아이콘을 동반한다 (§12.6 a11y)', () => {
    const { getByTestId } = render(
      <NicknameField value="가" onChangeText={jest.fn()} error="2자 이상 입력해주세요" />,
      { wrapper },
    );

    expect(getByTestId('nickname-error-icon')).toBeTruthy();
  });

  test('maxLength로 상한 초과 입력 자체를 막는다', () => {
    const { getByTestId } = render(<NicknameField value="" onChangeText={jest.fn()} />, {
      wrapper,
    });

    expect(getByTestId('nickname-input').props.maxLength).toBe(12);
  });

  test('한국어 입력 보조 비활성 — 자동 대문자·자동 수정이 닉네임을 바꾸면 안 된다', () => {
    const { getByTestId } = render(<NicknameField value="" onChangeText={jest.fn()} />, {
      wrapper,
    });

    const input = getByTestId('nickname-input');
    expect(input.props.autoCapitalize).toBe('none');
    expect(input.props.autoCorrect).toBe(false);
  });

  test('accessibilityLabel 부여', () => {
    const { getByLabelText } = render(<NicknameField value="" onChangeText={jest.fn()} />, {
      wrapper,
    });

    expect(getByLabelText('닉네임')).toBeTruthy();
  });

  test('키보드 완료 키 → onSubmit', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = render(
      <NicknameField value="민수" onChangeText={jest.fn()} onSubmit={onSubmit} />,
      { wrapper },
    );

    fireEvent(getByTestId('nickname-input'), 'submitEditing');

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
