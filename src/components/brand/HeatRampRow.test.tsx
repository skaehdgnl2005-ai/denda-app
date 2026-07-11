import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import { HeatRampRow } from './HeatRampRow';
import { ThemeProvider } from '@/design/theme';
import { tokens } from '@/design/tokens';

function flat(node: { props: { style?: unknown } }): Record<string, unknown> {
  return StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
}

describe('HeatRampRow — heat 램프 미니 시각', () => {
  it('heat-0 셀에 border-subtle hairline → 흰 배경에서 비가시 방지 (W3-4)', () => {
    const { getByTestId } = render(<HeatRampRow />, { wrapper: ThemeProvider });
    // 램프 셀은 accessibilityElementsHidden(장식) → 숨김 요소 포함 조회.
    const cell0 = flat(getByTestId('heat-ramp-row-cell-0', { includeHiddenElements: true }));
    // heat-0(surface-2 근접, 흰색톤)은 흰 surface-0 위에서 사라짐 → hairline border로 윤곽 확보.
    expect(cell0.borderColor).toBe(tokens.light.border.subtle);
    expect(cell0.borderWidth as number).toBeGreaterThan(0);
  });
});
