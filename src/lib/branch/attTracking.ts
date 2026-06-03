// S15-deeplink (D28) — iOS ATT(App Tracking Transparency) 첫 launch 프롬프트.
//
// 왜 필요:
//   자체 deferred deep link는 server-side에서 IP/UA 해시(HMAC-SHA256)로 매칭한다.
//   IDFA는 사용 안 하지만, Apple ATT 정의상 "다른 도메인/앱에서 수집된 데이터와
//   사용자 데이터 연결"이라 tracking으로 분류됨 → 프롬프트 의무.
//
// 동작:
//   - iOS 14+ 한정. Android·web은 skipped.
//   - 한 번만 프롬프트 — SecureStore flag(`ATT_FLAG_KEY`)로 idempotency.
//   - 거부해도 서비스 동작 무관(서버 측 매칭은 IDFA 미사용).
//
// DI 친화 — production wiring은 _layout.tsx에서 expo-tracking-transparency + SecureStore
// + Platform을 묶어 호출. 본 lib는 dynamic require 없이 순수 함수 + interface.

export const ATT_FLAG_KEY = 'denda_att_prompted_v1';

export type AttStatus = 'granted' | 'denied' | 'undetermined' | 'restricted' | 'skipped';

export interface AttTrackingApi {
  getTrackingPermissionsAsync(): Promise<{ status: string }>;
  requestTrackingPermissionsAsync(): Promise<{ status: string }>;
}

export interface AttStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

export interface AttPlatformInfo {
  isIos: boolean;
}

export interface RequestAttArgs {
  api: AttTrackingApi;
  storage: AttStorage;
  platform: AttPlatformInfo;
}

/**
 * 첫 launch 시 ATT 프롬프트. iOS 한정 idempotent.
 *
 * 반환:
 *   - 'skipped' — 비-iOS 또는 storage 에러(베타 best-effort)
 *   - 'granted' / 'denied' / 'undetermined' / 'restricted' — 현재 OS status
 *
 * 호출 위치: app/_layout.tsx의 mount 시점 (1회).
 */
export async function requestAttPermissionOnce(args: RequestAttArgs): Promise<AttStatus> {
  if (!args.platform.isIos) {
    return 'skipped';
  }

  let alreadyPrompted: boolean;
  try {
    const flag = await args.storage.getItemAsync(ATT_FLAG_KEY);
    alreadyPrompted = flag !== null;
  } catch {
    // SecureStore 접근 실패 — 베타: silent skip. ATT 프롬프트는 서비스 동작과 무관.
    return 'skipped';
  }

  if (alreadyPrompted) {
    const current = await args.api.getTrackingPermissionsAsync();
    return normalizeStatus(current.status);
  }

  // 첫 launch — 현재 status 확인 후 undetermined만 request.
  const current = await args.api.getTrackingPermissionsAsync();
  let finalStatus: AttStatus;
  if (current.status === 'undetermined') {
    const requested = await args.api.requestTrackingPermissionsAsync();
    finalStatus = normalizeStatus(requested.status);
  } else {
    finalStatus = normalizeStatus(current.status);
  }

  try {
    await args.storage.setItemAsync(ATT_FLAG_KEY, '1');
  } catch {
    // SecureStore write 실패도 silent — 다음 launch에 재시도되어도 OS가 알아서 skip.
  }
  return finalStatus;
}

function normalizeStatus(raw: string): AttStatus {
  if (raw === 'granted' || raw === 'denied' || raw === 'undetermined' || raw === 'restricted') {
    return raw;
  }
  return 'undetermined';
}
