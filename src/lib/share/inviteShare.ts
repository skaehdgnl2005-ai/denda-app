// S24 — 친구탭 "카톡으로 초대" 실연결.
//
// kakaoShare.ts(S08)와 동일 패턴: React Native 내장 Share API → 시스템 share sheet 노출.
// 베타엔 앱 다운로드 URL이 없으므로(EAS Build 운영 prereq) 메시지만 전송.
// EAS Build 후 URL 인자 추가 가능.

import type { ShareApi } from './kakaoShare';

export interface ShareInviteArgs {
  /** 초대하는 사람 닉네임. 빈 값/공백이면 머리말에서 생략. */
  inviterNickname?: string;
  /** 선택 — 앱 다운로드 URL 또는 invite URL. EAS Build 후 추가 가능. */
  url?: string;
}

export interface ShareInviteResult {
  shared: boolean;
}

export interface ShareInviteOptions {
  shareApi?: ShareApi;
}

const SHARED_ACTION = 'sharedAction';
const APP_NAME = '된다';

/**
 * 친구 초대 share용 message 빌더.
 * - inviterNickname 있으면: "○○님이 된다에서 함께하자고 해요. ..."
 * - 없으면: "친구를 된다에 초대해요. ..."
 */
export function buildInviteMessage(args: ShareInviteArgs): string {
  const nickname = args.inviterNickname?.trim() ?? '';
  const head = nickname
    ? `${nickname}님이 ${APP_NAME}에서 함께하자고 해요.`
    : `친구를 ${APP_NAME}에 초대해요.`;
  const body = `시간 · 장소 · 예약을 한 번에 잡아봐요.`;
  if (args.url) {
    return `${head}\n${body}\n${args.url}`;
  }
  return `${head}\n${body}`;
}

export async function shareInviteToKakao(
  args: ShareInviteArgs,
  options: ShareInviteOptions = {},
): Promise<ShareInviteResult> {
  const { shareApi } = options;
  if (!shareApi) {
    throw new Error('shareApi 가 필요해요. createNativeShareApi() 주입 권장.');
  }

  const message = buildInviteMessage(args);
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
