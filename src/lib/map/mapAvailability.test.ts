import { isMapAvailable } from './mapAvailability';

// 지도 활성화 게이트 (D38). env DI로 양 경로 검증 — 실제 EXPO_PUBLIC_* 인라인과 무관하게 테스트.
describe('isMapAvailable', () => {
  test('enabled + 실제 clientId → true', () => {
    expect(isMapAvailable({ enabled: true, clientId: 'abc123def' })).toBe(true);
  });

  test('enabled=false → false (키 있어도 비활성)', () => {
    expect(isMapAvailable({ enabled: false, clientId: 'abc123def' })).toBe(false);
  });

  test('clientId가 placeholder → false', () => {
    expect(isMapAvailable({ enabled: true, clientId: 'your-naver-client-id' })).toBe(false);
  });

  test('clientId 빈 문자열 → false', () => {
    expect(isMapAvailable({ enabled: true, clientId: '' })).toBe(false);
  });
});
