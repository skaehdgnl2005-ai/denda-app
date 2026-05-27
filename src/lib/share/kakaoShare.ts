// S08-ui — "장소만 정하기" 카톡 공유 wrapper.
//
// React Native 내장 Share API → iOS/Android 시스템 share sheet 노출.
// 사용자가 share sheet에서 카카오톡(또는 기타) 선택 → 메시지 전달.
//
// 패턴:
//   await sharePlaceToKakao({groupName, placeName, url});
//
// DI:
//   options.shareApi — 테스트에서 inject. production은 RN core `Share` 모듈을
//   create helper로 wrap (createNativeShareApi()).

export interface SharePlaceArgs {
  groupName: string;
  placeName: string;
  /** 선택 — 게스트 페이지 단축 URL 또는 카카오맵 링크. 없으면 message에만 포함. */
  url?: string;
}

export interface SharePlaceResult {
  shared: boolean;
}

export interface ShareApi {
  share(content: { message: string; url?: string }, options?: unknown): Promise<{ action: string }>;
}

export interface SharePlaceOptions {
  shareApi?: ShareApi;
}

const SHARED_ACTION = 'sharedAction';

/**
 * 카톡(또는 기타) share용 message 빌더. 빈 값은 한국어 fallback.
 */
export function buildSharePlaceMessage(args: SharePlaceArgs): string {
  const group = args.groupName.trim() || '모임';
  const place = args.placeName.trim() || '장소';
  const head = `${group} 장소: ${place}`;
  if (args.url) {
    return `${head}\n${args.url}`;
  }
  return head;
}

export async function sharePlaceToKakao(
  args: SharePlaceArgs,
  options: SharePlaceOptions = {},
): Promise<SharePlaceResult> {
  const { shareApi } = options;
  if (!shareApi) {
    throw new Error('shareApi 가 필요해요. createNativeShareApi() 주입 권장.');
  }

  const message = buildSharePlaceMessage(args);
  const content: { message: string; url?: string } = { message };
  if (args.url) {
    content.url = args.url;
  }

  try {
    const result = await shareApi.share(content);
    return { shared: result.action === SHARED_ACTION };
  } catch {
    throw new Error('공유에 실패했어요. 잠시 후 다시 시도해주세요.');
  }
}

// ---------------------------------------------------------------------------
// dynamicRequire 어댑터 (production wiring)
// ---------------------------------------------------------------------------

// Metro 프로덕션 번들러는 require(변수)를 거부 → 호출부에서 `() => require('pkg')` thunk로 전달
// (리터럴 문자열). require는 factory 호출 시에만 실행 → cold start(D25) 영향 없음.
function loadOptionalModule<T = unknown>(load: () => T, packageName: string): T {
  try {
    return load();
  } catch {
    throw new Error(
      `${packageName} 패키지가 설치되지 않았어요. 다음 EAS Build 시점에 \`npx expo install ${packageName}\`을 실행해 주세요.`,
    );
  }
}

/**
 * react-native `Share` 모듈을 lazy require → ShareApi shape으로 wrap.
 */
export function createNativeShareApi(): ShareApi {
  const mod = loadOptionalModule(
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    () => require('react-native'),
    'react-native',
  ) as {
    Share: {
      share(
        content: { message: string; url?: string },
        options?: unknown,
      ): Promise<{ action: string }>;
    };
  };
  return {
    share: (content, options) => mod.Share.share(content, options),
  };
}
