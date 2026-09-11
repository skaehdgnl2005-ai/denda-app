// S17 CP5 — 사진 권한 거부 + canceled + base64 누락 + uri mimeType 추론 + 모듈 unavailable
// 분기 검증. imagePicker.ts는 `loadPicker` DI 매개변수로 jest mock 주입(production은 default).

import {
  ImagePickerPermissionDeniedError,
  ImagePickerUnavailableError,
  pickImageFromLibrary,
} from './imagePicker';

type PickerModuleLike = {
  requestMediaLibraryPermissionsAsync(): Promise<{ granted: boolean }>;
  launchImageLibraryAsync(opts: unknown): Promise<{
    canceled: boolean;
    assets?: { uri?: string; base64?: string; mimeType?: string }[];
  }>;
  MediaTypeOptions?: { Images?: unknown };
};

function makePickerMock(): PickerModuleLike & {
  requestMediaLibraryPermissionsAsync: jest.Mock;
  launchImageLibraryAsync: jest.Mock;
} {
  return {
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
    MediaTypeOptions: { Images: 'Images' },
  };
}

describe('Error classes', () => {
  test('ImagePickerUnavailableError name + 한국어 안내', () => {
    const e = new ImagePickerUnavailableError();
    expect(e.name).toBe('ImagePickerUnavailableError');
    expect(e.message).toContain('expo-image-picker');
    expect(e.message).toContain('다음 빌드');
  });

  test('ImagePickerPermissionDeniedError name + 한국어 안내', () => {
    const e = new ImagePickerPermissionDeniedError();
    expect(e.name).toBe('ImagePickerPermissionDeniedError');
    expect(e.message).toContain('사진 접근 권한');
  });
});

describe('pickImageFromLibrary', () => {
  test('권한 거부 → ImagePickerPermissionDeniedError + launchImageLibraryAsync 미호출', async () => {
    const mod = makePickerMock();
    mod.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false });
    await expect(pickImageFromLibrary(async () => mod)).rejects.toBeInstanceOf(
      ImagePickerPermissionDeniedError,
    );
    expect(mod.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  test('사용자 취소 (canceled=true) → "canceled" Error', async () => {
    const mod = makePickerMock();
    mod.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    mod.launchImageLibraryAsync.mockResolvedValue({ canceled: true });
    await expect(pickImageFromLibrary(async () => mod)).rejects.toThrow('canceled');
  });

  test('assets 빈 배열 → "canceled" Error (defensive)', async () => {
    const mod = makePickerMock();
    mod.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    mod.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [] });
    await expect(pickImageFromLibrary(async () => mod)).rejects.toThrow('canceled');
  });

  test('base64 누락 → 한국어 변환 실패 Error', async () => {
    const mod = makePickerMock();
    mod.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    mod.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://x.png' }],
    });
    await expect(pickImageFromLibrary(async () => mod)).rejects.toThrow(
      'base64로 변환하지 못했어요',
    );
  });

  test('PNG mimeType hint → png 그대로 반환', async () => {
    const mod = makePickerMock();
    mod.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    mod.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://photo.png', base64: 'AAAA', mimeType: 'image/png' }],
    });
    const result = await pickImageFromLibrary(async () => mod);
    expect(result).toEqual({ base64: 'AAAA', mimeType: 'image/png' });
  });

  test('mimeType hint 없으면 uri 확장자로 추론 (.jpg → image/jpeg)', async () => {
    const mod = makePickerMock();
    mod.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    mod.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://photo.jpg', base64: 'BBBB' }],
    });
    const result = await pickImageFromLibrary(async () => mod);
    expect(result.mimeType).toBe('image/jpeg');
  });

  test('uri 확장자 .webp → image/webp', async () => {
    const mod = makePickerMock();
    mod.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    mod.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://photo.webp', base64: 'CCCC' }],
    });
    const result = await pickImageFromLibrary(async () => mod);
    expect(result.mimeType).toBe('image/webp');
  });

  test('uri 확장자 없으면 jpeg 기본', async () => {
    const mod = makePickerMock();
    mod.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    mod.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://unknown', base64: 'DDDD' }],
    });
    const result = await pickImageFromLibrary(async () => mod);
    expect(result.mimeType).toBe('image/jpeg');
  });

  test('loader가 "Cannot find module" Error → ImagePickerUnavailableError로 wrap', async () => {
    await expect(
      pickImageFromLibrary(async () => {
        throw new Error('Cannot find module expo-image-picker from ...');
      }),
    ).rejects.toBeInstanceOf(ImagePickerUnavailableError);
  });

  test('loader가 "expo-image-picker" 포함 Error → Unavailable로 wrap', async () => {
    await expect(
      pickImageFromLibrary(async () => {
        throw new Error('Failed to require expo-image-picker native module');
      }),
    ).rejects.toBeInstanceOf(ImagePickerUnavailableError);
  });
});
