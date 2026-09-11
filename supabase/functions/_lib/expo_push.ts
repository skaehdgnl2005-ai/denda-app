// 공통 Expo Push helper — notify_f1/f2/f3/f4/f5 공유 (S12)
//
// F-type 무관 공통 로직:
//   - Expo Push API endpoint + chunk fan-out
//   - ticket 분리 (success vs failure + reason)
//   - JSONB partial_fail_list entry 빌드 (D19)
//
// F-type별 specific 로직 (recipient 필터·메시지 컴포지션·idempotency 컬럼)은 각 notify_f* 안에 유지.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_CHUNK_SIZE = 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  userId: string;
  data?: Record<string, unknown>;
}

export type ExpoPushTicket =
  | { status: 'ok'; id: string }
  | {
      status: 'error';
      message: string;
      details?: { error?: string };
    };

export interface PushFailure {
  userId: string;
  reason: string;
}

export interface PartitionResult {
  successfulCount: number;
  failures: PushFailure[];
}

export interface PartialFailEntry {
  user_id: string;
  reason: string;
  channel: string;
  occurred_at: string;
}

export interface BuildPartialFailArgs {
  failures: PushFailure[];
  channel: string;
  occurredAtKstIso: string;
}

// ---------------------------------------------------------------------------
// 순수 함수
// ---------------------------------------------------------------------------

/**
 * Expo push response → success/fail 분리.
 *
 * - tickets.length < messages.length → 부족분은 'no_ticket' 사유로 실패
 * - 같은 user 여러 디바이스 → 각 ticket 별로 카운트 (partial 자연 기록)
 */
export function partitionPushResponses(
  messages: ExpoPushMessage[],
  tickets: ExpoPushTicket[],
): PartitionResult {
  let successfulCount = 0;
  const failures: PushFailure[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const ticket = tickets[i];
    if (!ticket) {
      failures.push({ userId: msg.userId, reason: 'no_ticket' });
      continue;
    }
    if (ticket.status === 'ok') {
      successfulCount++;
      continue;
    }
    const reason = ticket.details?.error ?? ticket.message ?? 'unknown';
    failures.push({ userId: msg.userId, reason });
  }
  return { successfulCount, failures };
}

export function buildPartialFailList(
  args: BuildPartialFailArgs,
): PartialFailEntry[] {
  return args.failures.map((f) => ({
    user_id: f.userId,
    reason: f.reason,
    channel: args.channel,
    occurred_at: args.occurredAtKstIso,
  }));
}

// ---------------------------------------------------------------------------
// Expo Push API
// ---------------------------------------------------------------------------

interface ExpoPushResponse {
  data: ExpoPushTicket[];
  errors?: Array<{ code: string; message: string }>;
}

async function sendExpoPushChunk(
  messages: ExpoPushMessage[],
): Promise<ExpoPushTicket[]> {
  if (messages.length === 0) return [];
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const body = messages.map((m) => ({
    to: m.to,
    title: m.title,
    body: m.body,
    ...(m.data ? { data: m.data } : {}),
  }));
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return messages.map(() => ({
      status: 'error' as const,
      message: `Expo HTTP ${res.status}`,
    }));
  }
  const json = (await res.json()) as ExpoPushResponse;
  return json.data ?? [];
}

export async function sendExpoPushAll(
  messages: ExpoPushMessage[],
): Promise<ExpoPushTicket[]> {
  const tickets: ExpoPushTicket[] = [];
  for (let i = 0; i < messages.length; i += EXPO_CHUNK_SIZE) {
    const chunk = messages.slice(i, i + EXPO_CHUNK_SIZE);
    const partial = await sendExpoPushChunk(chunk);
    tickets.push(...partial);
  }
  return tickets;
}
