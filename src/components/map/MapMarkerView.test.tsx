import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import { MapMarkerView } from './MapMarkerView';
import { ThemeProvider } from '@/design/theme';
import { tokens } from '@/design/tokens';
import type { MapMarker } from '@/lib/map/mapScene';

function marker(overrides: Partial<MapMarker> = {}): MapMarker {
  return { id: 'm', coord: { lat: 37.5, lng: 127.0 }, kind: 'place', label: '한솥', ...overrides };
}

function flatStyle(node: { props: { [key: string]: unknown } }): Record<string, unknown> {
  return StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
}

describe('MapMarkerView — 보라톤 커스텀 마커 (D40, PNG 래스터 대체)', () => {
  it('place 마커 → brand-500 fill(§10.5) + 흰 inner stroke(surface-0) 2pt + 원형', () => {
    const { getByTestId } = render(<MapMarkerView marker={marker()} />, { wrapper: ThemeProvider });
    const s = flatStyle(getByTestId('map-marker-view'));
    expect(s.backgroundColor).toBe(tokens.light.brand[500]); // 메인 브랜드 보라 (heat ramp 동일)
    expect(s.borderColor).toBe(tokens.light.surface[0]); // §10.2 흰 stroke(다크는 0F0F12)
    expect(s.borderWidth).toBe(2);
    expect(s.borderRadius).toBe((s.width as number) / 2); // 완전 원형
  });

  it('emphasized(제휴) 마커 → brand-500 fill + 더 큰 지름 (§10.2 1.4×, 색 아닌 크기로 강조)', () => {
    const plain = render(<MapMarkerView marker={marker()} />, { wrapper: ThemeProvider });
    const emph = render(<MapMarkerView marker={marker({ emphasized: true, kind: 'partner' })} />, {
      wrapper: ThemeProvider,
    });
    const sp = flatStyle(plain.getByTestId('map-marker-view'));
    const se = flatStyle(emph.getByTestId('map-marker-view'));
    expect(se.backgroundColor).toBe(tokens.light.brand[500]);
    expect(se.width as number).toBeGreaterThan(sp.width as number);
  });

  it('order 마커 → 시간순 숫자 라벨 표시 (§10.5 brand fill + 흰 숫자)', () => {
    const { getByText } = render(
      <MapMarkerView marker={marker({ kind: 'order', order: 2, label: '2' })} />,
      { wrapper: ThemeProvider },
    );
    expect(getByText('2')).toBeTruthy();
  });

  it('place 마커 → 마커 안에 텍스트 없음 (장소명은 caption으로 지도에 표시)', () => {
    const { queryByText } = render(<MapMarkerView marker={marker({ label: '한솥' })} />, {
      wrapper: ThemeProvider,
    });
    expect(queryByText('한솥')).toBeNull();
  });

  it('hex 직접 색 없음 — 모두 DESIGN 토큰 (light 테마 값과 일치)', () => {
    const { getByTestId } = render(<MapMarkerView marker={marker({ emphasized: true })} />, {
      wrapper: ThemeProvider,
    });
    const s = flatStyle(getByTestId('map-marker-view'));
    // 토큰 외 색이면 실패 — brand[500] 일치 검증
    expect(s.backgroundColor).toBe(tokens.light.brand[500]);
  });
});
