import React from 'react';
import { render } from '@testing-library/react-native';
import { Title, Body, Caption } from './typography';
import { ThemeProvider } from './theme';

describe('Typography Components', () => {
  test('Title renders correctly with level h1, h2, h3 styles', () => {
    const { getByText, rerender } = render(<Title level="h1">제목1</Title>, {
      wrapper: ThemeProvider,
    });
    const textH1 = getByText('제목1');
    expect(textH1.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontSize: 24,
          lineHeight: 32,
          fontWeight: '700',
        }),
      ]),
    );

    rerender(<Title level="h2">제목2</Title>);
    const textH2 = getByText('제목2');
    expect(textH2.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontSize: 20,
          lineHeight: 28,
          fontWeight: '600',
        }),
      ]),
    );

    rerender(<Title level="h3">제목3</Title>);
    const textH3 = getByText('제목3');
    expect(textH3.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontSize: 18,
          lineHeight: 24,
          fontWeight: '600',
        }),
      ]),
    );
  });

  test('Body renders correctly with primary, bold, sm, sm-bold styles', () => {
    const { getByText, rerender } = render(<Body variant="primary">본문</Body>, {
      wrapper: ThemeProvider,
    });
    const textPrimary = getByText('본문');
    expect(textPrimary.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontSize: 16,
          lineHeight: 24,
          fontWeight: '400',
        }),
      ]),
    );

    rerender(<Body variant="bold">본문 볼드</Body>);
    const textBold = getByText('본문 볼드');
    expect(textBold.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontSize: 16,
          lineHeight: 24,
          fontWeight: '600',
        }),
      ]),
    );

    rerender(<Body variant="sm">본문 소</Body>);
    const textSm = getByText('본문 소');
    expect(textSm.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontSize: 14,
          lineHeight: 20,
          fontWeight: '400',
        }),
      ]),
    );

    rerender(<Body variant="sm-bold">본문 소 볼드</Body>);
    const textSmBold = getByText('본문 소 볼드');
    expect(textSmBold.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontSize: 14,
          lineHeight: 20,
          fontWeight: '600',
        }),
      ]),
    );
  });

  test('Caption renders correctly with default, micro, button styles', () => {
    const { getByText, rerender } = render(<Caption variant="default">캡션</Caption>, {
      wrapper: ThemeProvider,
    });
    const textDefault = getByText('캡션');
    expect(textDefault.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontSize: 13,
          lineHeight: 18,
          fontWeight: '500',
        }),
      ]),
    );

    rerender(<Caption variant="micro">마이크로</Caption>);
    const textMicro = getByText('마이크로');
    expect(textMicro.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontSize: 11,
          lineHeight: 16,
          fontWeight: '500',
        }),
      ]),
    );

    rerender(<Caption variant="button">버튼</Caption>);
    const textButton = getByText('버튼');
    expect(textButton.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontSize: 16,
          lineHeight: 20,
          fontWeight: '600',
        }),
      ]),
    );
  });

  test('tabularNums prop applies fontVariant tabular-nums', () => {
    const { getByText } = render(
      <Body variant="primary" tabularNums>
        12:30
      </Body>,
      {
        wrapper: ThemeProvider,
      },
    );
    const text = getByText('12:30');
    expect(text.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontVariant: ['tabular-nums'],
        }),
      ]),
    );
  });
});
