// iOS 권한 사용 문구(Info.plist NS*UsageDescription) 정합성.
//
// 왜 테스트가 필요한가:
//   1. Expo config plugin은 선언하지 않아도 autolink되어 **영문 기본값**을 Info.plist에 박는다
//      ("Allow $(PRODUCT_NAME) to access your calendars"). 한국어 전용 베타에서 시스템 권한
//      팝업만 영어로 뜨는 회귀 — CLAUDE.md 절대 규칙 4 위반.
//   2. 안 쓰는 권한(카메라·마이크·미리 알림·Face ID)까지 기본값으로 딸려 들어간다.
//      App Store 심사에서 "이 권한을 왜 요구하나" 문의 사유이자 불필요한 privacy 노출.
//
// 검증 대상은 app.config.ts가 plugin에 넘기는 props. `@expo/config-plugins`의
// applyPermissions는 `custom[key] || infoPlist[key] || default` 순으로 적용하고,
// `custom[key] === false`면 키를 **삭제**한다. 따라서 props만 고정하면 결과가 결정된다.

import appConfig from '../../app.config';

type PluginEntry = string | [string, Record<string, unknown>];

const config = appConfig({ config: {} } as never);
const plugins = (config.plugins ?? []) as PluginEntry[];

function pluginProps(name: string): Record<string, unknown> | undefined {
  const entry = plugins.find((p) => (Array.isArray(p) ? p[0] === name : p === name));
  if (entry === undefined) return undefined;
  return Array.isArray(entry) ? entry[1] : {};
}

/** 영문 기본값 감지 — plugin 기본 문구는 전부 이 접두사로 시작한다. */
const ENGLISH_DEFAULT = /^Allow \$\(PRODUCT_NAME\)/;
const HANGUL = /[가-힣]/;

describe('iOS 권한 문구 (한국어 전용 베타)', () => {
  describe('실제로 쓰는 권한 — 한국어 문구 명시', () => {
    it('캘린더: 모임 확정 시 일정 추가(S06)에 쓰므로 한국어 사유 필요', () => {
      const props = pluginProps('expo-calendar');
      expect(props).toBeDefined();
      const permission = props?.calendarPermission;
      expect(typeof permission).toBe('string');
      expect(permission as string).toMatch(HANGUL);
      expect(permission as string).not.toMatch(ENGLISH_DEFAULT);
    });

    it('사진 라이브러리: 시간표 OCR(S03b)에 쓰므로 한국어 사유 필요', () => {
      const props = pluginProps('expo-image-picker');
      expect(props).toBeDefined();
      const permission = props?.photosPermission;
      expect(typeof permission).toBe('string');
      expect(permission as string).toMatch(HANGUL);
      expect(permission as string).not.toMatch(ENGLISH_DEFAULT);
    });

    it('ATT: 이미 한국어 (S15 D28 — 회귀 가드)', () => {
      const props = pluginProps('expo-tracking-transparency');
      expect(props?.userTrackingPermission as string).toMatch(HANGUL);
    });
  });

  describe('안 쓰는 권한 — 명시적으로 제거 (false)', () => {
    it('카메라: pickImageFromLibrary는 launchImageLibraryAsync만 호출 — 촬영 없음', () => {
      expect(pluginProps('expo-image-picker')?.cameraPermission).toBe(false);
    });

    it('마이크: 동영상 촬영 미사용', () => {
      expect(pluginProps('expo-image-picker')?.microphonePermission).toBe(false);
    });

    it('미리 알림(Reminders): AppleCalendarProvider는 이벤트만 생성 — EKReminder 미사용', () => {
      expect(pluginProps('expo-calendar')?.remindersPermission).toBe(false);
    });

    it('Face ID: SecureStore를 requireAuthentication 없이 사용 — 생체 인증 미사용', () => {
      expect(pluginProps('expo-secure-store')?.faceIDPermission).toBe(false);
    });
  });

  it('어떤 plugin props에도 영문 기본 문구가 남아 있지 않다', () => {
    const englishValues = plugins
      .filter((p): p is [string, Record<string, unknown>] => Array.isArray(p))
      .flatMap(([, props]) => Object.values(props ?? {}))
      .filter((v): v is string => typeof v === 'string')
      .filter((v) => ENGLISH_DEFAULT.test(v));
    expect(englishValues).toEqual([]);
  });
});
