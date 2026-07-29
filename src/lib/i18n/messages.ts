// UI 마이크로카피 단일 모음 (§17.6 톤: 친근체·질문형·자책 없음).
// ko-kr 룰의 i18n-ready 패턴 — 라벨/문구를 한곳에 모아 Q-B12 closure 시 이 파일만 수정.
// raw e.message를 사용자에게 노출하지 않도록 mapError()로 에러를 친절한 카피에 매핑한다.
//
// 사용: import { messages, mapError } from '@/lib/i18n/messages';

export const messages = {
  // 버튼·액션 라벨. "확인/취소" 시스템 톤은 시스템 경계에서만, 나머지는 행동 서술형.
  action: {
    confirm: '확인',
    cancel: '취소',
    retry: '다시 시도',
    close: '닫기',
    later: '다음에 할게요',
    goSee: '보러 가기',
    delete: '삭제하기',
    logout: '로그아웃',
  },

  // 성공 — 느낌표 + 반말 어미 (§17.6).
  success: {
    requestSent: '요청 보냈어요!',
    friendAdded: '친구가 됐어요!',
    invited: (n: number): string => `${n}명에게 초대를 보냈어요!`,
    joined: '모임에 합류했어요!',
    blocked: '차단했어요.',
    reported: '신고를 접수했어요.',
    placeConfirmed: '장소를 정했어요!',
    // Q-B12 closure 시 확정 문구 — 그때까지 기존 카피 유지
    reservationReady: '식당에 알릴 준비가 됐어요. 곧 안내를 보낼게요.',
    copied: '복사했어요!',
  },

  // 에러 — 자책 X, 함께 해결 톤 (§17.6). raw 메시지 대신 이 카피들로 매핑.
  error: {
    generic: '문제가 생겼어요. 잠시 후 다시 시도해볼게요.',
    network: '연결이 불안정해요. 잠시 후 다시 시도해볼게요.',
    load: '불러오지 못했어요. 다시 시도해볼게요.',
    save: '저장하지 못했어요. 다시 시도해볼게요.',
    permission: '권한이 필요해요. 설정에서 허용해 주세요.', // 사용자 실제 행동 필요 — 예외적 안내형
    rateLimit: '요청이 많아요. 잠시 후 다시 시도해볼게요.',
    expired: '인증이 만료됐어요. 다시 시도해볼게요.',
  },

  // 닉네임 설정·변경 (2026-07-29 스펙 §7).
  nickname: {
    signupTitle: '어떤 이름으로 부를까요?',
    signupBody: '친구들이 이 이름으로 회원님을 찾아요',
    editTitle: '닉네임 변경',
    placeholder: '닉네임',
    hint: '한글·영문·숫자·밑줄 2~12자',
    submitSignup: '확인',
    submitEdit: '저장',
    saved: '닉네임을 바꿨어요!',
  },

  // 빈 상태 — §11.2 3요소(title·body·cta). 아이콘·시각은 EmptyState 컴포넌트가 담당.
  empty: {
    homeGroups: {
      title: '아직 잡힌 모임이 없어요',
      body: '첫 모임을 만들어볼까요?',
      cta: '모임 만들기',
    },
    friends: {
      title: '아직 친구가 없어요',
      body: '카톡으로 친구를 초대해보세요',
      cta: '카톡으로 초대',
    },
    mapResults: {
      title: '이 영역에 매장이 없어요',
      body: '반경을 넓혀서 다시 찾아볼까요?',
      cta: '반경 넓히기',
    },
  },
} as const;

/**
 * 닉네임 실패 사유 → 사용자 카피.
 *
 * mapError()를 태우지 않는 이유: mapError는 raw 메시지를 버리고 큐레이션된 일반 카피로
 * 덮어쓴다. 여기서는 "무엇이 잘못됐는지"가 사용자가 다음에 할 행동을 결정하므로
 * 사유별 카피가 그대로 전달돼야 한다.
 */
export function nicknameErrorMessage(
  reason: 'too_short' | 'too_long' | 'invalid_chars' | 'taken',
): string {
  switch (reason) {
    case 'too_short':
      return '2자 이상 입력해주세요';
    case 'too_long':
      return '12자까지 쓸 수 있어요';
    case 'invalid_chars':
      return '한글·영문·숫자·밑줄만 쓸 수 있어요';
    case 'taken':
      return '이미 사용 중인 닉네임이에요';
  }
}

/** 취소류 에러인지 — 사용자가 스스로 그만둔 것이므로 에러로 표출하지 않는다. */
function isCancelled(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const name = err.name ?? '';
  if (name === 'AbortError' || name === 'CanceledError') return true;
  const msg = err.message ?? '';
  return /cancell?ed|aborted|사용자.*취소|취소.*했/i.test(msg);
}

type ErrorKey = keyof typeof messages.error;

/** Error 신호(name/message)로 카테고리를 분류. raw 메시지는 절대 반환하지 않는다. */
function classify(err: unknown): ErrorKey {
  if (!(err instanceof Error)) return 'generic';
  const msg = (err.message ?? '').toLowerCase();
  if (/network|fetch|timeout|econn|offline|연결/.test(msg)) return 'network';
  if (/unauthor|permission|denied|403|권한/.test(msg)) return 'permission';
  if (/rate.?limit|429|too many/.test(msg)) return 'rateLimit';
  if (/expired|token|401|만료/.test(msg)) return 'expired';
  return 'generic';
}

/**
 * 임의의 throw 값을 사용자에게 보여줄 친절한 한국어 카피로 매핑.
 * - 취소류 → { silent: true } (호출부가 조용히 닫음)
 * - 그 외 → 큐레이션된 messages.error.* (raw e.message 노출 0)
 */
export function mapError(err: unknown): { silent: boolean; message: string } {
  if (isCancelled(err)) return { silent: true, message: '' };
  return { silent: false, message: messages.error[classify(err)] };
}
