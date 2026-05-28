// S17 CP5 — 에브리타임 OCR 화면. 권한 거부 + 모듈 미가용 + 사용자 취소 + 일반 에러 +
// OCR 빈 결과 + 성공 → preview 분기. handlePickAndOcr 핵심 Alert 분기 검증.

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import EverytimeImportScreen from '../../../app/schedule/everytime';
import { ThemeProvider } from '@/design/theme';
import {
  ImagePickerPermissionDeniedError,
  ImagePickerUnavailableError,
} from '@/lib/ocr/imagePicker';

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

// semester validation은 default false. 테스트별로 mock 갱신. SemesterInput가 다른 export
// (formatSemesterError 등)에도 의존하므로 requireActual로 나머지 유지.
const mockIsSemesterValid = jest.fn<boolean, [string, string]>(() => false);
jest.mock('@/lib/ocr/semesterValidation', () => {
  const actual = jest.requireActual('@/lib/ocr/semesterValidation');
  return {
    ...actual,
    isSemesterValid: (start: string, end: string) => mockIsSemesterValid(start, end),
  };
});

describe('EverytimeImportScreen', () => {
  const wrapper = ThemeProvider;
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPickImage.mockReset();
    mockPreview.mockReset();
    mockConfirm.mockReset();
    mockIsSemesterValid.mockReset();
    mockIsSemesterValid.mockReturnValue(false);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  test('semester 미입력 시 "시간표 사진 선택" 버튼 disabled + 안내 카피', () => {
    mockIsSemesterValid.mockReturnValue(false);
    const { getByTestId, getByText } = render(<EverytimeImportScreen />, { wrapper });
    const btn = getByTestId('pick-image-button');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
    expect(getByText(/학기 기간을 입력하면/)).toBeTruthy();
  });

  test('semester 입력 + OCR 권한 거부 → "권한 필요" Alert + input step 유지', async () => {
    mockIsSemesterValid.mockReturnValue(true);
    mockPickImage.mockRejectedValueOnce(new ImagePickerPermissionDeniedError());
    const { getByTestId } = render(<EverytimeImportScreen />, { wrapper });
    fireEvent.press(getByTestId('pick-image-button'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const [title, body] = alertSpy.mock.calls[0]!;
    expect(title).toBe('권한 필요');
    expect(body).toMatch(/사진 접근 권한/);
  });

  test('expo-image-picker 미가용 → "곧 활성화돼요" Alert', async () => {
    mockIsSemesterValid.mockReturnValue(true);
    mockPickImage.mockRejectedValueOnce(new ImagePickerUnavailableError());
    const { getByTestId } = render(<EverytimeImportScreen />, { wrapper });
    fireEvent.press(getByTestId('pick-image-button'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const [title, body] = alertSpy.mock.calls[0]!;
    expect(title).toBe('곧 활성화돼요');
    expect(body).toMatch(/expo-image-picker/);
  });

  test('사용자 취소 (canceled) → Alert 호출 없음 (silent)', async () => {
    mockIsSemesterValid.mockReturnValue(true);
    mockPickImage.mockRejectedValueOnce(new Error('canceled'));
    const { getByTestId } = render(<EverytimeImportScreen />, { wrapper });
    fireEvent.press(getByTestId('pick-image-button'));
    await waitFor(() => expect(mockPickImage).toHaveBeenCalledTimes(1));
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('일반 Error → "OCR 실패" Alert + 친근체 폴백', async () => {
    mockIsSemesterValid.mockReturnValue(true);
    mockPickImage.mockResolvedValueOnce({ base64: 'AAAA', mimeType: 'image/png' });
    mockPreview.mockRejectedValueOnce(new Error('서버 일시 오류'));
    const { getByTestId } = render(<EverytimeImportScreen />, { wrapper });
    fireEvent.press(getByTestId('pick-image-button'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const [title, body] = alertSpy.mock.calls[0]!;
    expect(title).toBe('OCR 실패');
    expect(body).toBe('서버 일시 오류');
  });

  test('OCR 결과 빈 → "강의를 찾지 못했어요" Alert + input step 유지', async () => {
    mockIsSemesterValid.mockReturnValue(true);
    mockPickImage.mockResolvedValueOnce({ base64: 'AAAA', mimeType: 'image/png' });
    mockPreview.mockResolvedValueOnce({ courses: [] });
    const { getByTestId } = render(<EverytimeImportScreen />, { wrapper });
    fireEvent.press(getByTestId('pick-image-button'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const [title, body] = alertSpy.mock.calls[0]!;
    expect(title).toBe('OCR 결과');
    expect(body).toMatch(/강의를 찾지 못했어요/);
  });

  test('OCR 성공 → preview step (강의 카드 + 강의 추가 버튼 노출)', async () => {
    mockIsSemesterValid.mockReturnValue(true);
    mockPickImage.mockResolvedValueOnce({ base64: 'AAAA', mimeType: 'image/png' });
    mockPreview.mockResolvedValueOnce({
      courses: [{ name: '선형대수', day: 'MON', start: '10:00', end: '11:30', room: '공학관 401' }],
    });
    const { getByTestId } = render(<EverytimeImportScreen />, { wrapper });
    fireEvent.press(getByTestId('pick-image-button'));
    await waitFor(() => expect(getByTestId('add-course-button')).toBeTruthy());
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('back 버튼 press → router.back()', () => {
    const { getByTestId } = render(<EverytimeImportScreen />, { wrapper });
    fireEvent.press(getByTestId('back-button'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
