// S15-deeplink (D28) — iOS ATT(App Tracking Transparency) 첫 launch 프롬프트.
//
// 본 테스트는 requestAttPermissionOnce의 idempotent + iOS gate 동작을 검증.
// expo-tracking-transparency native 호출은 DI로 mock.

import { requestAttPermissionOnce, ATT_FLAG_KEY } from './attTracking';

describe('requestAttPermissionOnce — iOS ATT 프롬프트', () => {
  let storage: {
    getItemAsync: jest.Mock;
    setItemAsync: jest.Mock;
  };
  let api: {
    getTrackingPermissionsAsync: jest.Mock;
    requestTrackingPermissionsAsync: jest.Mock;
  };

  beforeEach(() => {
    storage = {
      getItemAsync: jest.fn().mockResolvedValue(null),
      setItemAsync: jest.fn().mockResolvedValue(undefined),
    };
    api = {
      getTrackingPermissionsAsync: jest.fn().mockResolvedValue({ status: 'undetermined' }),
      requestTrackingPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    };
  });

  describe('비-iOS 플랫폼', () => {
    it('Android 등은 skipped 반환 + API 호출 없음', async () => {
      const result = await requestAttPermissionOnce({
        api,
        storage,
        platform: { isIos: false },
      });

      expect(result).toBe('skipped');
      expect(api.getTrackingPermissionsAsync).not.toHaveBeenCalled();
      expect(api.requestTrackingPermissionsAsync).not.toHaveBeenCalled();
      expect(storage.setItemAsync).not.toHaveBeenCalled();
    });
  });

  describe('iOS · 첫 launch (flag 미존재 + undetermined)', () => {
    it('request 호출 + flag SET + status 반환', async () => {
      storage.getItemAsync.mockResolvedValue(null);
      api.getTrackingPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
      api.requestTrackingPermissionsAsync.mockResolvedValue({ status: 'granted' });

      const result = await requestAttPermissionOnce({
        api,
        storage,
        platform: { isIos: true },
      });

      expect(result).toBe('granted');
      expect(api.requestTrackingPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(storage.setItemAsync).toHaveBeenCalledWith(ATT_FLAG_KEY, '1');
    });

    it('사용자가 거부해도 flag SET', async () => {
      api.requestTrackingPermissionsAsync.mockResolvedValue({ status: 'denied' });

      const result = await requestAttPermissionOnce({
        api,
        storage,
        platform: { isIos: true },
      });

      expect(result).toBe('denied');
      expect(storage.setItemAsync).toHaveBeenCalledWith(ATT_FLAG_KEY, '1');
    });
  });

  describe('iOS · 이미 프롬프트 표시됨 (flag 존재)', () => {
    it('현재 status 조회 + request 미호출', async () => {
      storage.getItemAsync.mockResolvedValue('1');
      api.getTrackingPermissionsAsync.mockResolvedValue({ status: 'granted' });

      const result = await requestAttPermissionOnce({
        api,
        storage,
        platform: { isIos: true },
      });

      expect(result).toBe('granted');
      expect(api.getTrackingPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(api.requestTrackingPermissionsAsync).not.toHaveBeenCalled();
      // 재호출이라 flag 재set은 불필요
      expect(storage.setItemAsync).not.toHaveBeenCalled();
    });

    it('사용자가 설정에서 거부로 바꿔도 denied 반환', async () => {
      storage.getItemAsync.mockResolvedValue('1');
      api.getTrackingPermissionsAsync.mockResolvedValue({ status: 'denied' });

      const result = await requestAttPermissionOnce({
        api,
        storage,
        platform: { isIos: true },
      });

      expect(result).toBe('denied');
      expect(api.requestTrackingPermissionsAsync).not.toHaveBeenCalled();
    });
  });

  describe('iOS · flag 미존재이지만 OS가 이미 결정 (settings 권한 직접 부여 etc.)', () => {
    it('현재 status 그대로 반환 + flag SET + request 미호출', async () => {
      storage.getItemAsync.mockResolvedValue(null);
      api.getTrackingPermissionsAsync.mockResolvedValue({ status: 'granted' });

      const result = await requestAttPermissionOnce({
        api,
        storage,
        platform: { isIos: true },
      });

      expect(result).toBe('granted');
      expect(api.requestTrackingPermissionsAsync).not.toHaveBeenCalled();
      expect(storage.setItemAsync).toHaveBeenCalledWith(ATT_FLAG_KEY, '1');
    });
  });

  describe('에러 격리', () => {
    it('storage read 실패 시 throw하지 않고 undetermined 처리(베타: silent)', async () => {
      storage.getItemAsync.mockRejectedValue(new Error('SecureStore 접근 실패'));

      // 베타 정책: ATT 프롬프트는 best-effort — storage 에러는 'skipped'로 처리
      const result = await requestAttPermissionOnce({
        api,
        storage,
        platform: { isIos: true },
      });

      expect(result).toBe('skipped');
      expect(api.requestTrackingPermissionsAsync).not.toHaveBeenCalled();
    });
  });
});
