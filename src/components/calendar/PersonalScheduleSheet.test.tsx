import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PersonalScheduleSheet } from './PersonalScheduleSheet';
import { ThemeProvider } from '@/design/theme';

const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/lib/schedules/personal', () => {
  const actual = jest.requireActual('@/lib/schedules/personal');
  return {
    ...actual,
    createPersonalSchedule: (...args: unknown[]) => mockCreate(...args),
    updatePersonalSchedule: (...args: unknown[]) => mockUpdate(...args),
    deletePersonalSchedule: (...args: unknown[]) => mockDelete(...args),
  };
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    }}
  >
    <ThemeProvider>{children}</ThemeProvider>
  </SafeAreaProvider>
);

function setup(overrides: Partial<React.ComponentProps<typeof PersonalScheduleSheet>> = {}) {
  const onClose = jest.fn();
  const onSaved = jest.fn();
  const utils = render(
    <PersonalScheduleSheet
      visible={overrides.visible ?? true}
      onClose={overrides.onClose ?? onClose}
      onSaved={overrides.onSaved ?? onSaved}
      userId={overrides.userId ?? 'u1'}
      dateIso={overrides.dateIso ?? '2026-07-18'}
      editing={overrides.editing ?? null}
    />,
    { wrapper },
  );
  return { onClose, onSaved, ...utils };
}

const editing = {
  scheduleId: 's1',
  title: '치과',
  startMinute: 600,
  endMinute: 690,
};

describe('PersonalScheduleSheet — 추가 모드', () => {
  beforeEach(() => {
    mockCreate.mockReset().mockResolvedValue({ id: 'new-1' });
    mockUpdate.mockReset().mockResolvedValue(undefined);
    mockDelete.mockReset().mockResolvedValue(undefined);
  });

  test('제목·날짜·기본 시간을 보여준다', () => {
    const { getByTestId } = setup();
    expect(getByTestId('personal-sheet-title').props.children).toBe('일정 추가');
    expect(getByTestId('personal-sheet-date').props.children).toBe('7월 18일 (토)');
    expect(getByTestId('personal-sheet-start').props.children).toBe('09:00');
    expect(getByTestId('personal-sheet-end').props.children).toBe('10:00');
  });

  test('저장 → createPersonalSchedule(userId, 입력) 후 onSaved·onClose', async () => {
    const { getByTestId, onSaved, onClose } = setup();
    fireEvent.changeText(getByTestId('personal-sheet-input'), '치과');
    await act(async () => {
      fireEvent.press(getByTestId('personal-sheet-save'));
    });
    expect(mockCreate).toHaveBeenCalledWith('u1', {
      title: '치과',
      dateIso: '2026-07-18',
      startMinute: 540,
      endMinute: 600,
    });
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test('빈 제목 저장 → 인라인 에러, 네트워크 미호출 (§11.3)', async () => {
    const { getByTestId, findByText } = setup();
    await act(async () => {
      fireEvent.press(getByTestId('personal-sheet-save'));
    });
    expect(await findByText('일정 이름을 입력해주세요.')).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('저장 실패 → 인라인 에러 유지, 시트는 닫히지 않는다', async () => {
    mockCreate.mockRejectedValueOnce(new Error('일정을 저장하지 못했어요.'));
    const { getByTestId, findByText, onClose } = setup();
    fireEvent.changeText(getByTestId('personal-sheet-input'), '치과');
    await act(async () => {
      fireEvent.press(getByTestId('personal-sheet-save'));
    });
    expect(await findByText('일정을 저장하지 못했어요.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('저장 진행 중 중복 탭은 1회만 호출', async () => {
    let resolveCreate: (v: unknown) => void = () => {};
    mockCreate.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveCreate = res;
        }),
    );
    const { getByTestId } = setup();
    fireEvent.changeText(getByTestId('personal-sheet-input'), '치과');
    await act(async () => {
      fireEvent.press(getByTestId('personal-sheet-save'));
      fireEvent.press(getByTestId('personal-sheet-save'));
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveCreate({ id: 'x' });
    });
  });

  test('시간 선택 — 15분 단위 옵션을 고르면 반영', async () => {
    const { getByTestId } = setup();
    await act(async () => {
      fireEvent.press(getByTestId('personal-sheet-start-field'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('time-option-1140'));
    });
    expect(getByTestId('personal-sheet-start').props.children).toBe('19:00');
    // 시작이 종료를 넘어서면 종료를 뒤로 밀어준다
    expect(getByTestId('personal-sheet-end').props.children).toBe('20:00');
  });

  test('추가 모드에는 삭제 버튼이 없다', () => {
    const { queryByTestId } = setup();
    expect(queryByTestId('personal-sheet-delete')).toBeNull();
  });
});

describe('PersonalScheduleSheet — 수정 모드', () => {
  beforeEach(() => {
    mockCreate.mockReset().mockResolvedValue({ id: 'new-1' });
    mockUpdate.mockReset().mockResolvedValue(undefined);
    mockDelete.mockReset().mockResolvedValue(undefined);
  });

  test('기존 값으로 채워지고 저장 시 update 호출', async () => {
    const { getByTestId, onSaved } = setup({ editing });
    expect(getByTestId('personal-sheet-title').props.children).toBe('일정 수정');
    expect(getByTestId('personal-sheet-input').props.value).toBe('치과');
    expect(getByTestId('personal-sheet-start').props.children).toBe('10:00');

    fireEvent.changeText(getByTestId('personal-sheet-input'), '치과 정기검진');
    await act(async () => {
      fireEvent.press(getByTestId('personal-sheet-save'));
    });
    expect(mockUpdate).toHaveBeenCalledWith('s1', {
      title: '치과 정기검진',
      dateIso: '2026-07-18',
      startMinute: 600,
      endMinute: 690,
    });
    expect(onSaved).toHaveBeenCalled();
  });

  test('삭제는 확인 시트를 거친 뒤 실행 (Alert 금지 §11.3)', async () => {
    const { getByTestId, onSaved } = setup({ editing });
    await act(async () => {
      fireEvent.press(getByTestId('personal-sheet-delete'));
    });
    expect(mockDelete).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(getByTestId('personal-delete-confirm-confirm'));
    });
    expect(mockDelete).toHaveBeenCalledWith('s1');
    expect(onSaved).toHaveBeenCalled();
  });
});
