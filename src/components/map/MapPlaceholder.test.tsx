import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ThemeProvider } from '@/design/theme';
import { MapPlaceholder } from './MapPlaceholder';

describe('MapPlaceholder', () => {
  test('schedule 모드 → schedule-map-placeholder testID + "리스트로 보기" 버튼', () => {
    const onShowList = jest.fn();
    const { getByTestId, getByText } = render(
      <MapPlaceholder mode="schedule" onShowList={onShowList} />,
      { wrapper: ThemeProvider },
    );
    expect(getByTestId('schedule-map-placeholder')).toBeTruthy();
    fireEvent.press(getByText('리스트로 보기'));
    expect(onShowList).toHaveBeenCalledTimes(1);
  });

  test('onShowList 미제공 → 리스트 유도 버튼 미노출', () => {
    const { queryByText } = render(<MapPlaceholder mode="schedule" />, {
      wrapper: ThemeProvider,
    });
    expect(queryByText('리스트로 보기')).toBeNull();
  });

  test('search 모드 → map-pending-notice testID', () => {
    const { getByTestId } = render(<MapPlaceholder mode="search" />, {
      wrapper: ThemeProvider,
    });
    expect(getByTestId('map-pending-notice')).toBeTruthy();
  });

  test('midpoint 모드 → midpoint-map-placeholder testID', () => {
    const { getByTestId } = render(<MapPlaceholder mode="midpoint" />, {
      wrapper: ThemeProvider,
    });
    expect(getByTestId('midpoint-map-placeholder')).toBeTruthy();
  });

  test('schedule 모드 body → 내부 빌드 용어 없이 친절한 안내', () => {
    const { getByText, queryByText } = render(<MapPlaceholder mode="schedule" />, {
      wrapper: ThemeProvider,
    });
    expect(getByText('지도는 준비 중이에요')).toBeTruthy();
    expect(getByText('곧 모임 일정을 지도 위에서 볼 수 있어요.')).toBeTruthy();
    expect(queryByText(/정식 앱 빌드|빌드/)).toBeNull();
  });

  test('search 모드 body → 내부 빌드 용어 없이 친절한 안내', () => {
    const { getByText, queryByText } = render(<MapPlaceholder mode="search" />, {
      wrapper: ThemeProvider,
    });
    expect(getByText('지도는 준비 중이에요')).toBeTruthy();
    expect(getByText('곧 검색한 장소를 지도 위에서 볼 수 있어요.')).toBeTruthy();
    expect(queryByText(/정식 앱 빌드|빌드/)).toBeNull();
  });

  test('midpoint 모드 body → 내부 빌드 용어 없이 친절한 안내', () => {
    const { getByText, queryByText } = render(<MapPlaceholder mode="midpoint" />, {
      wrapper: ThemeProvider,
    });
    expect(getByText('지도는 준비 중이에요')).toBeTruthy();
    expect(getByText('곧 출발지와 중간지점을 지도 위에서 볼 수 있어요.')).toBeTruthy();
    expect(queryByText(/정식 앱 빌드|빌드/)).toBeNull();
  });
});
