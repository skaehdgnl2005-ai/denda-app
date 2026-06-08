/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock 팩토리는 hoisting 탓에 require 필수 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { ThemeProvider } from '@/design/theme';
import { isMapAvailable } from '@/lib/map/mapAvailability';
import type { MapScene } from '@/lib/map/mapScene';
import { MapHost } from './MapHost';

jest.mock('@/lib/map/mapAvailability', () => ({ isMapAvailable: jest.fn() }));

// 네이티브 SDK를 stub으로 대체 — 실제 NaverMapScene(매핑 로직)은 그대로 로드되고,
// NaverMapView/Overlay만 View로 치환된다. (실 네이티브 렌더·60fps 검증은 EAS 운영 트랙)
jest.mock('@mj-studio/react-native-naver-map', () => {
  const ReactMod = require('react');
  const { View } = require('react-native');
  const Stub = (props: { testID?: string; children?: unknown }): unknown =>
    ReactMod.createElement(View, { testID: props.testID }, props.children);
  return {
    __esModule: true,
    NaverMapView: Stub,
    NaverMapMarkerOverlay: Stub,
    NaverMapPathOverlay: Stub,
  };
});

const scene: MapScene = { mode: 'schedule', markers: [], polylines: [] };

describe('MapHost', () => {
  test('지도 불가 → fallback(placeholder) 렌더, 네이티브 미로드', () => {
    (isMapAvailable as jest.Mock).mockReturnValue(false);
    const { getByTestId, queryByTestId } = render(<MapHost scene={scene} />, {
      wrapper: ThemeProvider,
    });
    expect(getByTestId('schedule-map-placeholder')).toBeTruthy();
    expect(queryByTestId('naver-map-scene')).toBeNull();
  });

  test('지도 가능 → placeholder 미렌더 + Suspense 진입(로딩 fallback)', () => {
    // 동기 검증: 가능 분기에서 placeholder가 아니라 Suspense fallback(map-loading)이 즉시 렌더.
    // 실제 NaverMapScene 렌더는 네이티브(EAS) 트랙이라 CI 검증 대상 아님 — 분기 로직만 확정.
    // (보류된 lazy suspension이 test 종료 후 해소되며 act 경고를 남기지만 실패 아님 — 패키지 mock으로 무해.)
    (isMapAvailable as jest.Mock).mockReturnValue(true);
    const { queryByTestId, getByTestId } = render(<MapHost scene={scene} />, {
      wrapper: ThemeProvider,
    });
    expect(queryByTestId('schedule-map-placeholder')).toBeNull();
    expect(getByTestId('map-loading')).toBeTruthy();
  });

  test('지도 불가 + 커스텀 fallback → 커스텀 렌더', () => {
    const { Text } = require('react-native');
    (isMapAvailable as jest.Mock).mockReturnValue(false);
    const { getByText } = render(<MapHost scene={scene} fallback={<Text>커스텀 폴백</Text>} />, {
      wrapper: ThemeProvider,
    });
    expect(getByText('커스텀 폴백')).toBeTruthy();
  });
});
