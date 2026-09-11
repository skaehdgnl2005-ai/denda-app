import React from 'react';
import { render } from '@testing-library/react-native';

import { PartnerBadge } from './PartnerBadge';
import { ThemeProvider } from '@/design/theme';

function renderBadge() {
  return render(<PartnerBadge />, { wrapper: ThemeProvider });
}

describe('PartnerBadge — 제휴 식당 배지 (DESIGN §10.2 / §12.6)', () => {
  test('"제휴" 라벨 노출 (색 단독 의존 금지 — 텍스트 라벨 동반)', () => {
    const { getByText } = renderBadge();
    expect(getByText('제휴')).toBeTruthy();
  });

  test('accessibilityLabel="제휴 식당" (§12.3 스크린리더)', () => {
    const { getByTestId } = renderBadge();
    expect(getByTestId('partner-badge').props.accessibilityLabel).toBe('제휴 식당');
  });

  test('아이콘 동반 (§12.6 3중 신호 — 색 + 라벨 + 아이콘)', () => {
    // BadgeCheck 아이콘이 함께 렌더되는지 — testID 로 노출.
    const { getByTestId } = renderBadge();
    expect(getByTestId('partner-badge-icon')).toBeTruthy();
  });

  test('testID 오버라이드 가능', () => {
    const { getByTestId } = render(<PartnerBadge testID="custom-badge" />, {
      wrapper: ThemeProvider,
    });
    expect(getByTestId('custom-badge')).toBeTruthy();
  });
});
