// S03b — 이미지 선택 lazy wrapper. `expo-image-picker` 미설치 시 안내 throw.
// 설치 후엔 이 모듈이 dynamic import로 picker 호출.

export interface PickedImage {
  base64: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
}

export class ImagePickerUnavailableError extends Error {
  constructor() {
    super('사진 선택 기능은 다음 빌드에서 활성화돼요. (expo-image-picker 설치 필요)');
    this.name = 'ImagePickerUnavailableError';
  }
}

export class ImagePickerPermissionDeniedError extends Error {
  constructor() {
    super(
      '사진 접근 권한이 없어 시간표를 가져올 수 없어요. 설정에서 권한을 켠 뒤 다시 시도해주세요.',
    );
    this.name = 'ImagePickerPermissionDeniedError';
  }
}

// expo-image-picker 설치 전엔 unavailable. 설치 후 이 함수만 교체.
// dynamic import로 가둬 cold start 영향 0 (D25).
//
// `loadPicker` 매개변수: jest 환경에서 native dynamic import가 vm-modules 의존이라
// 테스트 시 mock을 주입할 수 있도록 DI. production은 default로 동일 동작 + lazy load.
type PickerModuleLike = {
  requestMediaLibraryPermissionsAsync(): Promise<{ granted: boolean }>;
  launchImageLibraryAsync(opts: unknown): Promise<{
    canceled: boolean;
    assets?: { uri?: string; base64?: string; mimeType?: string }[];
  }>;
  MediaTypeOptions?: { Images?: unknown };
};

const defaultLoadPicker = (): Promise<PickerModuleLike> =>
  import('expo-image-picker') as unknown as Promise<PickerModuleLike>;

export async function pickImageFromLibrary(
  loadPicker: () => Promise<PickerModuleLike> = defaultLoadPicker,
): Promise<PickedImage> {
  try {
    const mod = await loadPicker();
    const permission = await mod.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new ImagePickerPermissionDeniedError();
    }
    const result = await mod.launchImageLibraryAsync({
      mediaTypes: mod.MediaTypeOptions?.Images ?? 'Images',
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets || result.assets.length === 0) {
      throw new Error('canceled');
    }
    const asset = result.assets[0];
    if (!asset || !asset.base64) {
      throw new Error('이미지를 base64로 변환하지 못했어요.');
    }
    const mimeType = inferMimeType(asset.uri ?? '', asset.mimeType ?? undefined);
    return { base64: asset.base64, mimeType };
  } catch (e) {
    if (e instanceof ImagePickerPermissionDeniedError) throw e;
    if (e instanceof Error && e.message === 'canceled') throw e;
    // module not found (Metro / Jest) → unavailable
    if (
      e instanceof Error &&
      (e.message.includes('Cannot find module') || e.message.includes('expo-image-picker'))
    ) {
      throw new ImagePickerUnavailableError();
    }
    throw e;
  }
}

function inferMimeType(
  uri: string,
  hinted: string | undefined,
): 'image/png' | 'image/jpeg' | 'image/webp' {
  if (hinted === 'image/png' || hinted === 'image/jpeg' || hinted === 'image/webp') return hinted;
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}
