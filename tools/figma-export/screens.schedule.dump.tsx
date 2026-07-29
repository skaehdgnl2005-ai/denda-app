// 일정 화면(에브리타임 OCR · 지도로 내 일정 보기)을 Figma 아트보드로 내보낸다.
// mock 세트는 tests/screens/schedule/*.test.tsx에서 이미 통과가 검증된 것을 그대로 복제한다.
//
// jest.mock은 모듈 스코프라 화면 그룹마다 파일 하나를 둔다 (emitPart가 파트를 합쳐준다).
// 실행: npx jest --config jest.figma.config.js --testPathPattern screens.schedule
import React from 'react';
import { View } from 'react-native';
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DateTime } from 'luxon';

import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';
import type { ConfirmedGroupScheduleInput } from '@/lib/schedules/scheduleMapPoint';
import { emitPart } from './emit';
import { fromTestInstance, normalize, type SourceNode } from './normalize';
import type { IRArtboard, IRNode } from './ir';

const KST = 'Asia/Seoul';
const nowKst = DateTime.now().setZone(KST);

/** 지도 화면의 기본 필터는 '이번 주' — 픽스처를 오늘로 잡아야 시간이 지나도 안 깨진다. */
function kstTodayAtUtcIso(hour: number): string {
  return nowKst.set({ hour, minute: 0, second: 0, millisecond: 0 }).toUTC().toISO() ?? '';
}

// ── mock 세트: tests/screens/schedule/everytime.test.tsx + map.test.tsx 복제 ──

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

const mockPickImage = jest.fn();
jest.mock('@/lib/ocr/imagePicker', () => {
  const actual = jest.requireActual('@/lib/ocr/imagePicker');
  return {
    ...actual,
    pickImageFromLibrary: (...args: unknown[]) => mockPickImage(...args),
  };
});

const mockPreview = jest.fn();
const mockConfirm = jest.fn();
jest.mock('@/lib/ocr/everytime', () => ({
  previewEverytimeOcr: (...args: unknown[]) => mockPreview(...args),
  confirmEverytimeOcr: (...args: unknown[]) => mockConfirm(...args),
}));

const mockIsSemesterValid = jest.fn<boolean, [string, string]>(() => false);
jest.mock('@/lib/ocr/semesterValidation', () => {
  const actual = jest.requireActual('@/lib/ocr/semesterValidation');
  return {
    ...actual,
    isSemesterValid: (start: string, end: string) => mockIsSemesterValid(start, end),
  };
});

const mockFetchConfirmed = jest.fn();
jest.mock('@/lib/schedules/groupScheduleQueries', () => ({
  fetchConfirmedGroupSchedules: () => mockFetchConfirmed(),
}));

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const useColorSchemeMock = require('react-native/Libraries/Utilities/useColorScheme')
  .default as jest.Mock;

// mock 등록 이후에 import해야 한다.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const EverytimeImportScreen = require('../../app/schedule/everytime')
  .default as React.ComponentType;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ScheduleMapScreen = require('../../app/schedule/map').default as React.ComponentType;

const SCREEN_WIDTH = 390;
const INSETS = {
  frame: { x: 0, y: 0, width: SCREEN_WIDTH, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const ROOT_MARKER = 'figma-fixture-root';

function Harness({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <SafeAreaProvider initialMetrics={INSETS}>
      <ThemeProvider>
        <ToastProvider>
          <View testID={ROOT_MARKER} style={{ width: SCREEN_WIDTH }}>
            {children}
          </View>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function findRoot(node: SourceNode): SourceNode | null {
  if (node.isHost && node.props.testID === ROOT_MARKER) return node;
  for (const c of node.children) {
    if (typeof c === 'string') continue;
    const found = findRoot(c);
    if (found) return found;
  }
  return null;
}

/** 캡처 직전까지 resolve되지 않는 promise — 로딩 상태를 고정한다. */
function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {
    // 의도적으로 resolve하지 않는다.
  });
}

const SAMPLE_COURSES = [
  { name: '선형대수', day: 'MON', start: '10:00', end: '11:30', room: '공학관 401' },
  { name: '자료구조', day: 'WED', start: '13:00', end: '14:30', room: '정보관 203' },
  { name: '경영학원론', day: 'FRI', start: '15:00', end: '16:30', room: '상경관 105' },
];

const baseSchedule: ConfirmedGroupScheduleInput = {
  groupId: 'g1',
  groupName: '동아리 저녁',
  placeId: 'p1',
  placeName: '광장시장',
  lat: 37.5704,
  lng: 126.9999,
  confirmedStartAt: kstTodayAtUtcIso(19),
};

interface ScreenFixture {
  id: string;
  name: string;
  element: React.ReactElement;
  /** 렌더 직전 데이터 mock 설정 */
  setup: () => void;
  /** 렌더 후 상태 전환 (누르기 등). 없으면 초기 상태를 그대로 캡처한다. */
  interact?: (r: RenderResult) => Promise<void>;
}

const screens: ScreenFixture[] = [
  {
    id: 'screen/everytime-input',
    name: '에브리타임 · 학기 입력',
    element: <EverytimeImportScreen />,
    setup: () => {
      mockIsSemesterValid.mockReset().mockReturnValue(false);
      mockPickImage.mockReset();
      mockPreview.mockReset();
      mockConfirm.mockReset();
    },
  },
  {
    id: 'screen/everytime-loading',
    name: '에브리타임 · 인식 중',
    element: <EverytimeImportScreen />,
    setup: () => {
      mockIsSemesterValid.mockReset().mockReturnValue(true);
      mockPickImage.mockReset().mockImplementation(() => pendingForever());
      mockPreview.mockReset();
      mockConfirm.mockReset();
    },
    interact: async (r) => {
      fireEvent.press(r.getByTestId('pick-image-button'));
      await r.findByTestId('ocr-loading');
    },
  },
  {
    id: 'screen/everytime-preview',
    name: '에브리타임 · 강의 확인',
    element: <EverytimeImportScreen />,
    setup: () => {
      mockIsSemesterValid.mockReset().mockReturnValue(true);
      mockPickImage.mockReset().mockResolvedValue({ base64: 'AAAA', mimeType: 'image/png' });
      mockPreview.mockReset().mockResolvedValue({ courses: SAMPLE_COURSES });
      mockConfirm.mockReset();
    },
    interact: async (r) => {
      fireEvent.press(r.getByTestId('pick-image-button'));
      await r.findByTestId('add-course-button');
    },
  },
  {
    id: 'screen/schedule-map-list',
    name: '일정 지도 · 리스트',
    element: <ScheduleMapScreen />,
    setup: () => {
      mockFetchConfirmed.mockReset().mockResolvedValue([
        {
          ...baseSchedule,
          groupId: 'g1',
          groupName: '점심 모임',
          confirmedStartAt: kstTodayAtUtcIso(12),
        },
        {
          ...baseSchedule,
          groupId: 'g2',
          groupName: '스터디',
          placeId: 'p2',
          placeName: '홍대입구역 카페',
          lat: 37.5572,
          lng: 126.9245,
          confirmedStartAt: kstTodayAtUtcIso(15),
        },
        {
          ...baseSchedule,
          groupId: 'g3',
          groupName: '동아리 저녁',
          confirmedStartAt: kstTodayAtUtcIso(19),
        },
      ]);
    },
    interact: async (r) => {
      await r.findByTestId('schedule-point-1');
    },
  },
  {
    id: 'screen/schedule-map-empty',
    name: '일정 지도 · 빈 상태',
    element: <ScheduleMapScreen />,
    setup: () => {
      mockFetchConfirmed.mockReset().mockResolvedValue([]);
    },
    interact: async (r) => {
      await r.findByTestId('schedule-empty');
    },
  },
  {
    id: 'screen/schedule-map-placeholder',
    name: '일정 지도 · 지도 모드',
    element: <ScheduleMapScreen />,
    setup: () => {
      mockFetchConfirmed.mockReset().mockResolvedValue([baseSchedule]);
    },
    interact: async (r) => {
      await r.findByTestId('schedule-point-1');
      fireEvent.press(r.getByTestId('view-mode-map'));
      await r.findByTestId('schedule-map-placeholder');
    },
  },
];

describe('figma-export 일정 화면 덤프', () => {
  it(`화면 ${screens.length}개를 라이트·다크로 내보낸다`, async () => {
    const artboards: IRArtboard[] = [];
    const warnings: string[] = [];

    for (const theme of ['light', 'dark'] as const) {
      useColorSchemeMock.mockReturnValue(theme);

      for (const screen of screens) {
        screen.setup();
        const r = render(<Harness>{screen.element}</Harness>);
        await act(async () => {});
        if (screen.interact) await screen.interact(r);
        await act(async () => {});

        const marked = findRoot(fromTestInstance(r.UNSAFE_root));
        if (!marked) throw new Error(`${screen.id}: 화면 루트를 찾지 못했습니다.`);

        const result = normalize(marked);
        let root: IRNode = result.root;
        if (root.kind === 'frame' && root.children.length === 1) root = root.children[0] ?? root;
        root.name = screen.name;

        artboards.push({
          id: `${screen.id}/${theme}`,
          group: '일정 화면',
          name: screen.name,
          theme,
          frameWidth: SCREEN_WIDTH,
          root,
        });
        warnings.push(...result.warnings.map((w) => `[${screen.id}/${theme}] ${w}`));
        r.unmount();
      }
    }

    emitPart('screens-schedule', { artboards, warnings });

    expect(artboards).toHaveLength(screens.length * 2);
  });
});
