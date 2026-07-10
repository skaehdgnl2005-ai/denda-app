import React from 'react';
import { render } from '@testing-library/react-native';
import { Header } from './Header';
import { ThemeProvider } from '../../design/theme';

describe('Header Component', () => {
  const wrapper = ThemeProvider;

  test('renders day header correctly', () => {
    const { getByText } = render(<Header type="day" label="월" />, { wrapper });
    const dayText = getByText('월');
    expect(dayText).toBeTruthy();
    expect(dayText.props.allowFontScaling).toBe(false);
  });

  test('W2-5 — 요일 + 날짜 2줄 (sublabel은 tabular-nums)', () => {
    const { getByText } = render(<Header type="day" label="수" sublabel="7/8" />, { wrapper });
    expect(getByText('수')).toBeTruthy();
    const dateText = getByText('7/8');
    expect(dateText).toBeTruthy();
    expect(dateText.props.allowFontScaling).toBe(false);
    expect(dateText.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontVariant: ['tabular-nums'] })]),
    );
  });

  test('renders time header with tabular-nums and no font scaling', () => {
    const { getByText } = render(<Header type="time" label="09:00" />, { wrapper });
    const timeText = getByText('09:00');
    expect(timeText).toBeTruthy();
    expect(timeText.props.allowFontScaling).toBe(false);
    expect(timeText.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontVariant: ['tabular-nums'],
        }),
      ]),
    );
  });
});
