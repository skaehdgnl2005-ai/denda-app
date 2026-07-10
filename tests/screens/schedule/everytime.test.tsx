// S17 CP5 / W1-6 — 에브리타임 OCR 화면.
// Alert 6곳 → 프리미티브 전환 검증: 학기 미입력=인라인 힌트(disabled) · OCR 결과없음/실패=error Toast
// · 모듈 미가용=안내 Toast · 권한 거부=ConfirmSheet(설정 열기→Linking.openSettings) · 저장 실패=mapError Toast.
// OCR 진행=Skeleton 프리뷰 + 진행 카피. 사용자 취소=silent.

import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import EverytimeImportScreen from '../../../app/schedule/everytime';
import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';
import {
  ImagePickerPermissionDeniedError,
  ImagePickerUnavailableError,
} from '@/lib/ocr/imagePicker';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  </SafeAreaProvider>
);

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
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

describe('EverytimeImportScreen (W1-6 프리미티브 전환)', () => {
  let settingsSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPickImage.mockReset();
    mockPreview.mockReset();
    mockConfirm.mockReset();
    mockIsSemesterValid.mockReset();
    mockIsSemesterValid.mockReturnValue(false);
    settingsSpy = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
  });

  afterEach(() => {
    settingsSpy.mockRestore();
  });

  test('semester 미입력 → "시간표 사진 선택" 버튼 disabled + 인라인 안내 카피 (Alert 없음)', () => {
    mockIsSemesterValid.mockReturnValue(false);
    const { getByTestId, getByText } = render(<EverytimeImportScreen />, { wrapper });
    const btn = getByTestId('pick-image-button');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
    expect(getByText(/학기 기간을 입력하면/)).toBeTruthy();
  });

  test('OCR 권한 거부 → 설정 이동 ConfirmSheet 노출 + 확정 시 Linking.openSettings', async () => {
    mockIsSemesterValid.mockReturnValue(true);
    mockPickImage.mockRejectedValueOnce(new ImagePickerPermissionDeniedError());
    const { getByTestId } = render(<EverytimeImportScreen />, { wrapper });
    fireEvent.press(getByTestId('pick-image-button'));
    await waitFor(() => expect(getByTestId('permission-sheet-confirm')).toBeTruthy());
    fireEvent.press(getByTestId('permission-sheet-confirm'));
    expect(settingsSpy).toHaveBeenCalledTimes(1);
  });

  test('expo-image-picker 미가용 → 안내 Toast (Alert 없음)', async () => {
    mockIsSemesterValid.mockReturnValue(true);
    mockPickImage.mockRejectedValueOnce(new ImagePickerUnavailableError());
    const { getByTestId, getByText } = render(<EverytimeImportScreen />, { wrapper });
    fireEvent.press(getByTestId('pick-image-button'));
    await waitFor(() => expect(getByTestId('toast')).toBeTruthy());
    expect(getByText(/곧 준비/)).toBeTruthy();
  });

  test('사용자 취소 (canceled) → Toast·Sheet 없음 (silent)', async () => {
    mockIsSemesterValid.mockReturnValue(true);
    mockPickImage.mockRejectedValueOnce(new Error('canceled'));
    const { getByTestId, queryByTestId } = render(<EverytimeImportScreen />, { wrapper });
    fireEvent.press(getByTestId('pick-image-button'));
    await waitFor(() => expect(mockPickImage).toHaveBeenCalledTimes(1));
    expect(queryByTestId('toast')).toBeNull();
    expect(queryByTestId('permission-sheet-confirm')).toBeNull();
  });

  test('일반 Error → error Toast + 큐레이션 카피 (raw 메시지 비노출)', async () => {
    mockIsSemesterValid.mockReturnValue(true);
    mockPickImage.mockResolvedValueOnce({ base64: 'AAAA', mimeType: 'image/png' });
    mockPreview.mockRejectedValueOnce(new Error('서버 일시 오류 raw stack'));
    const { getByTestId, queryByText } = render(<EverytimeImportScreen />, { wrapper });
    fireEvent.press(getByTestId('pick-image-button'));
    await waitFor(() => expect(getByTestId('toast')).toBeTruthy());
    expect(queryByText(/raw stack/)).toBeNull();
  });

  test('OCR 결과 빈 → error Toast "강의를 찾지 못했어요" + input step 유지', async () => {
    mockIsSemesterValid.mockReturnValue(true);
    mockPickImage.mockResolvedValueOnce({ base64: 'AAAA', mimeType: 'image/png' });
    mockPreview.mockResolvedValueOnce({ courses: [] });
    const { getByTestId, getByText } = render(<EverytimeImportScreen />, { wrapper });
    fireEvent.press(getByTestId('pick-image-button'));
    await waitFor(() => expect(getByTestId('toast')).toBeTruthy());
    expect(getByText(/강의를 찾지 못했어요/)).toBeTruthy();
    expect(getByTestId('pick-image-button')).toBeTruthy();
  });

  test('OCR 진행 중 → Skeleton 프리뷰 + "시간표를 읽고 있어요" 카피', async () => {
    mockIsSemesterValid.mockReturnValue(true);
    let resolvePreview: (v: { courses: [] }) => void = () => {};
    mockPickImage.mockResolvedValueOnce({ base64: 'AAAA', mimeType: 'image/png' });
    mockPreview.mockReturnValueOnce(
      new Promise((res) => {
        resolvePreview = res;
      }),
    );
    const { getByTestId, getByText } = render(<EverytimeImportScreen />, { wrapper });
    fireEvent.press(getByTestId('pick-image-button'));
    await waitFor(() => expect(getByTestId('ocr-loading')).toBeTruthy());
    expect(getByText(/시간표를 읽고 있어요/)).toBeTruthy();
    resolvePreview({ courses: [] });
  });

  test('OCR 성공 → preview step (강의 카드 + 강의 추가 버튼 노출)', async () => {
    mockIsSemesterValid.mockReturnValue(true);
    mockPickImage.mockResolvedValueOnce({ base64: 'AAAA', mimeType: 'image/png' });
    mockPreview.mockResolvedValueOnce({
      courses: [{ name: '선형대수', day: 'MON', start: '10:00', end: '11:30', room: '공학관 401' }],
    });
    const { getByTestId, queryByTestId } = render(<EverytimeImportScreen />, { wrapper });
    fireEvent.press(getByTestId('pick-image-button'));
    await waitFor(() => expect(getByTestId('add-course-button')).toBeTruthy());
    expect(queryByTestId('toast')).toBeNull();
  });

  test('저장 실패 → error Toast (mapError) + preview step 유지', async () => {
    mockIsSemesterValid.mockReturnValue(true);
    mockPickImage.mockResolvedValueOnce({ base64: 'AAAA', mimeType: 'image/png' });
    mockPreview.mockResolvedValueOnce({
      courses: [{ name: '선형대수', day: 'MON', start: '10:00', end: '11:30', room: '공학관 401' }],
    });
    mockConfirm.mockRejectedValueOnce(new Error('db write failed raw'));
    const { getByTestId, queryByText } = render(<EverytimeImportScreen />, { wrapper });
    fireEvent.press(getByTestId('pick-image-button'));
    await waitFor(() => expect(getByTestId('confirm-button')).toBeTruthy());
    fireEvent.press(getByTestId('confirm-button'));
    await waitFor(() => expect(getByTestId('toast')).toBeTruthy());
    expect(queryByText(/raw/)).toBeNull();
    expect(getByTestId('confirm-button')).toBeTruthy();
  });

  test('back 버튼 press → router.back()', () => {
    const { getByLabelText } = render(<EverytimeImportScreen />, { wrapper });
    fireEvent.press(getByLabelText('뒤로 가기'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
