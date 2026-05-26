// AppleCalendarProvider — expo-calendar 기반 iOS Calendar push wrapper.
//
// 본 lib는 클라이언트 전용(RN/Expo iOS). 의존성은 모두 주입(DI):
//   - api: expo-calendar 어댑터 (production 측에서 wiring — `src/lib/calendar/setup.ts` 가칭)
//
// Apple Calendar는 외부 push API 부재 → worker가 직접 push 못함.
// 본 lib는 client 측에서 `expo-calendar.createEventAsync`를 호출하는 wrapper만 제공.
// worker → client trigger 패턴은 [Q-B22](../../../docs/OPEN_QUESTIONS.md#q-b22--apple-calendar-sync-mechanism-worker--client-trigger-패턴)
// 결정 후 별도 sub-task(S06-worker-apple-trigger 가칭)에서 통합.
//
// 결정 의존:
//   - D13: 외부 캘린더 event timeZone='Asia/Seoul' 항상 명시
//   - D15: apple_ios bucket — iOS 디바이스의 모든 캘린더 통합. 본 lib는 specific provider
//          (iCloud vs Google iOS vs Outlook) 구분 안 함 — getDefaultCalendarAsync가 OS 결정 따름
//   - D19: silent fail 금지 — permission denied · createEventAsync 실패 모두 CalendarProviderError
//
// 본 sub-task(S06-apple-expo-calendar) 스코프: 클라이언트 lib 만.

import { type CalendarEventPayload, CalendarProviderError } from './google';

const KST_TIMEZONE = 'Asia/Seoul';

// ---------------------------------------------------------------------------
// shared types — re-export for caller convenience
// ---------------------------------------------------------------------------

export type { CalendarEventPayload };

// ---------------------------------------------------------------------------
// expo-calendar 어댑터 spec (DI). production은 `expo-calendar` 모듈로 wiring.
// ---------------------------------------------------------------------------

export type AppleCalendarPermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface AppleCalendarHandle {
  id: string;
  title: string;
  source: { name: string };
  allowsModifications: boolean;
}

/**
 * expo-calendar이 createEventAsync로 받는 event spec subset.
 * https://docs.expo.dev/versions/latest/sdk/calendar/#calendarcreateeventasync
 */
export interface AppleCalendarEvent {
  title: string;
  /** ISO string (expo-calendar이 timeZone과 함께 파싱). */
  startDate: string;
  endDate: string;
  notes?: string;
  location?: string;
  /** D13: 'Asia/Seoul' 항상 명시. expo-calendar은 timeZone 무시 가능성 있어 startDate ISO에 +09:00 fallback 별도 검토 — 본 ship은 timeZone 신뢰. */
  timeZone: string;
}

export interface AppleCalendarApi {
  getCalendarPermissionsAsync(): Promise<{
    status: AppleCalendarPermissionStatus;
  }>;
  requestCalendarPermissionsAsync(): Promise<{
    status: AppleCalendarPermissionStatus;
  }>;
  /** iOS 기본 캘린더. allowsModifications=false면 fallback 필요. */
  getDefaultCalendarAsync(): Promise<AppleCalendarHandle | null>;
  /** 모든 캘린더 list. fallback에서 첫 writable 선택용. */
  getCalendarsAsync(entityType?: string): Promise<AppleCalendarHandle[]>;
  /** event id 반환. 실패 시 throw. */
  createEventAsync(calendarId: string, event: AppleCalendarEvent): Promise<string>;
}

export interface AppleCalendarDeps {
  api: AppleCalendarApi;
}

// ---------------------------------------------------------------------------
// 순수 helpers
// ---------------------------------------------------------------------------

/**
 * CalendarEventPayload → expo-calendar event spec.
 * - title: 그대로
 * - notes: 한국어 본문 (KST 표기 포함)
 * - location: locationName (null이면 키 생략 — expo-calendar 빈 문자열 받지 않음)
 * - timeZone: 'Asia/Seoul' 항상 명시 (D13)
 */
export function buildAppleEvent(payload: CalendarEventPayload): AppleCalendarEvent {
  if (!payload.title || payload.title.trim().length === 0) {
    throw new Error('event title이 필요합니다.');
  }
  const event: AppleCalendarEvent = {
    title: payload.title,
    startDate: payload.startUtcIso,
    endDate: payload.endUtcIso,
    notes: payload.descriptionKo,
    timeZone: KST_TIMEZONE,
  };
  if (payload.locationName !== null && payload.locationName !== undefined) {
    event.location = payload.locationName;
  }
  return event;
}

/**
 * 사용 가능한 첫 writable calendar 선택.
 * 우선순위:
 *   1. defaultCalendar.allowsModifications=true → 그것 (사용자의 "기본" 캘린더)
 *   2. allCalendars의 첫 allowsModifications=true (구독·readonly calendar fallback)
 *   3. 모두 read-only → null (호출자가 unknown 에러 매핑)
 */
export function pickWritableCalendar(
  defaultCalendar: AppleCalendarHandle | null,
  allCalendars: AppleCalendarHandle[],
): AppleCalendarHandle | null {
  if (defaultCalendar?.allowsModifications) {
    return defaultCalendar;
  }
  return allCalendars.find((c) => c.allowsModifications) ?? null;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class AppleCalendarProvider {
  readonly providerName = 'apple_ios' as const;

  constructor(private readonly deps: AppleCalendarDeps) {}

  /**
   * 현재 권한 상태가 'granted'인지. 'denied'·'undetermined' 모두 false.
   * 첫 진입 시점에는 'undetermined' — requestPermission 호출 필요.
   */
  async isAuthorized(): Promise<boolean> {
    const { status } = await this.deps.api.getCalendarPermissionsAsync();
    return status === 'granted';
  }

  /**
   * 권한 요청 prompt. 결과가 granted 아니면 unauthorized throw.
   * - denied: 사용자가 명시 거부 → UI에서 "iOS 설정에서 허용해 주세요" 안내
   * - undetermined: 시스템 prompt 종료 안 됨(극히 드묾) → 동일 메시지
   */
  async requestPermission(): Promise<void> {
    const { status } = await this.deps.api.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      throw new CalendarProviderError({ kind: 'unauthorized' });
    }
  }

  /**
   * 외부 캘린더에 event 추가.
   *
   * 에러 정책:
   *   - 권한 미부여 → unauthorized (createEventAsync 미호출)
   *   - 쓸 수 있는 calendar 0개 → unknown ("쓸 수 있는 캘린더를 찾지 못했어요.")
   *   - createEventAsync throw → unknown (원본 message wrap)
   *   - createEventAsync 빈 응답 → unknown (방어적)
   */
  async insertEvent(payload: CalendarEventPayload): Promise<{ eventId: string }> {
    // 1) permission re-verify (UI 흐름과 별개로 직접 호출되는 케이스 안전망)
    const { status } = await this.deps.api.getCalendarPermissionsAsync();
    if (status !== 'granted') {
      throw new CalendarProviderError({ kind: 'unauthorized' });
    }

    // 2) writable calendar 선택
    const defaultCal = await this.deps.api.getDefaultCalendarAsync();
    let target: AppleCalendarHandle | null;
    if (defaultCal?.allowsModifications) {
      // 빠른 경로 — default가 writable이면 getCalendarsAsync 호출 회피
      target = defaultCal;
    } else {
      const allCalendars = await this.deps.api.getCalendarsAsync('event');
      target = pickWritableCalendar(defaultCal, allCalendars);
    }

    if (!target) {
      throw new CalendarProviderError({
        kind: 'unknown',
        message: '쓸 수 있는 캘린더를 찾지 못했어요.',
      });
    }

    // 3) event 생성
    const event = buildAppleEvent(payload);
    let eventId: string;
    try {
      eventId = await this.deps.api.createEventAsync(target.id, event);
    } catch (err) {
      throw new CalendarProviderError({
        kind: 'unknown',
        message: err instanceof Error ? err.message : 'expo-calendar createEventAsync 실패',
      });
    }

    if (typeof eventId !== 'string' || eventId.length === 0) {
      throw new CalendarProviderError({
        kind: 'unknown',
        message: 'expo-calendar 응답에 event id 없음',
      });
    }
    return { eventId };
  }
}
