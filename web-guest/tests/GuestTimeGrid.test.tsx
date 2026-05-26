import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import GuestTimeGrid from '../components/GuestTimeGrid';

// Mock Supabase client — debouncedCommit이 100ms 후 발화할 때 channel.send 호출도 안전 처리.
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [] }),
    })),
    rpc: jest.fn().mockResolvedValue({ error: null }),
    channel: jest.fn().mockImplementation(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      send: jest.fn().mockResolvedValue({}),
    })),
    removeChannel: jest.fn(),
  },
}));

describe('GuestTimeGrid', () => {
  const baseProps = {
    groupId: 'group-123',
    guestToken: 'guest-token-123',
    dates: ['2026-05-24', '2026-05-25'],
    votes: [] as Array<{
      day: string;
      start_minute: number;
      end_minute: number;
      guest_token?: string | null;
      user_id?: string | null;
    }>,
    memberCount: 2,
    onVoteStatusChange: jest.fn(),
    onVotesUpdated: jest.fn(),
  };

  describe('Render', () => {
    test('헤더에 dates 모두 "M/D" 포맷으로 렌더 (앞 0 제거)', () => {
      render(<GuestTimeGrid {...baseProps} dates={['2026-01-09', '2026-12-31']} />);
      expect(screen.getByText('1/9')).toBeInTheDocument();
      expect(screen.getByText('12/31')).toBeInTheDocument();
    });

    test('기존 케이스 — dates 5/24, 5/25 헤더 렌더', () => {
      render(<GuestTimeGrid {...baseProps} />);
      expect(screen.getByText('5/24')).toBeInTheDocument();
      expect(screen.getByText('5/25')).toBeInTheDocument();
    });

    test('시간 라벨 09:00 ~ 24:00 (16개 hour label) 렌더', () => {
      render(<GuestTimeGrid {...baseProps} />);
      expect(screen.getByText('09:00')).toBeInTheDocument();
      expect(screen.getByText('12:00')).toBeInTheDocument();
      expect(screen.getByText('24:00')).toBeInTheDocument();
    });

    test('cell 총 개수 = 60 슬롯 × dates.length (3일 = 180)', () => {
      const { container } = render(
        <GuestTimeGrid {...baseProps} dates={['2026-05-24', '2026-05-25', '2026-05-26']} />,
      );
      const cells = container.querySelectorAll('[data-slot-cell]');
      expect(cells.length).toBe(60 * 3);
    });

    test('첫·마지막 슬롯 data-minute (540=09:00, 1425=23:45)', () => {
      const { container } = render(<GuestTimeGrid {...baseProps} />);
      expect(
        container.querySelector('[data-day="2026-05-24"][data-minute="540"]'),
      ).toBeInTheDocument();
      expect(
        container.querySelector('[data-day="2026-05-24"][data-minute="1425"]'),
      ).toBeInTheDocument();
    });

    test('범위 밖 슬롯(525, 1440)은 렌더 안 됨', () => {
      const { container } = render(<GuestTimeGrid {...baseProps} />);
      expect(
        container.querySelector('[data-day="2026-05-24"][data-minute="525"]'),
      ).not.toBeInTheDocument();
      expect(
        container.querySelector('[data-day="2026-05-24"][data-minute="1440"]'),
      ).not.toBeInTheDocument();
    });

    test('legend "비어있음" / "가득참" 렌더', () => {
      render(<GuestTimeGrid {...baseProps} />);
      expect(screen.getByText('비어있음')).toBeInTheDocument();
      expect(screen.getByText('가득참')).toBeInTheDocument();
    });
  });

  describe('Cell toggle (single click)', () => {
    test('기존 케이스 — mousedown으로 cell 선택 + border-brand-500', () => {
      const { container } = render(<GuestTimeGrid {...baseProps} />);
      const cell = container.querySelector(
        '[data-day="2026-05-24"][data-minute="540"]',
      ) as HTMLElement;
      expect(cell).toBeInTheDocument();
      expect(cell).not.toHaveClass('border-brand-500');

      fireEvent.mouseDown(cell);
      expect(cell).toHaveClass('border-brand-500');
    });

    test('이미 선택된 cell 다시 mousedown → deselect (border-brand-500 제거)', () => {
      const { container } = render(<GuestTimeGrid {...baseProps} />);
      const cell = container.querySelector(
        '[data-day="2026-05-24"][data-minute="540"]',
      ) as HTMLElement;

      fireEvent.mouseDown(cell);
      expect(cell).toHaveClass('border-brand-500');

      fireEvent.mouseUp(cell);
      fireEvent.mouseDown(cell);
      expect(cell).not.toHaveClass('border-brand-500');
    });

    test('mouseup이 dragMode reset — 다음 mousedown은 새 toggle cycle', () => {
      const { container } = render(<GuestTimeGrid {...baseProps} />);
      const cellA = container.querySelector(
        '[data-day="2026-05-24"][data-minute="540"]',
      ) as HTMLElement;
      const cellB = container.querySelector(
        '[data-day="2026-05-24"][data-minute="555"]',
      ) as HTMLElement;

      fireEvent.mouseDown(cellA);
      fireEvent.mouseUp(cellA);
      // 이전 dragMode가 reset됐다면 cellB의 mousedown은 새 toggle (select)
      fireEvent.mouseDown(cellB);
      expect(cellB).toHaveClass('border-brand-500');
      // cellA는 이전 mousedown으로 select된 상태 유지
      expect(cellA).toHaveClass('border-brand-500');
    });
  });

  describe('Drag sweep (multi-cell)', () => {
    test('mousedown → mouseEnter 연쇄로 같은 일자 다중 셀 select', () => {
      const { container } = render(<GuestTimeGrid {...baseProps} />);
      const cell1 = container.querySelector(
        '[data-day="2026-05-24"][data-minute="540"]',
      ) as HTMLElement;
      const cell2 = container.querySelector(
        '[data-day="2026-05-24"][data-minute="555"]',
      ) as HTMLElement;
      const cell3 = container.querySelector(
        '[data-day="2026-05-24"][data-minute="570"]',
      ) as HTMLElement;

      fireEvent.mouseDown(cell1);
      fireEvent.mouseEnter(cell2);
      fireEvent.mouseEnter(cell3);

      expect(cell1).toHaveClass('border-brand-500');
      expect(cell2).toHaveClass('border-brand-500');
      expect(cell3).toHaveClass('border-brand-500');
    });

    test('deselect mode — initialVotes로 선택된 cell에서 시작 → drag로 다중 deselect', () => {
      const initialVotes = [
        {
          day: '2026-05-24',
          start_minute: 540,
          end_minute: 555,
          guest_token: 'guest-token-123',
          user_id: null,
        },
        {
          day: '2026-05-24',
          start_minute: 555,
          end_minute: 570,
          guest_token: 'guest-token-123',
          user_id: null,
        },
      ];
      const { container } = render(<GuestTimeGrid {...baseProps} votes={initialVotes} />);
      const cell1 = container.querySelector(
        '[data-day="2026-05-24"][data-minute="540"]',
      ) as HTMLElement;
      const cell2 = container.querySelector(
        '[data-day="2026-05-24"][data-minute="555"]',
      ) as HTMLElement;

      // 두 셀 모두 선택된 상태로 mount
      expect(cell1).toHaveClass('border-brand-500');
      expect(cell2).toHaveClass('border-brand-500');

      // 선택된 cell1에서 mousedown → dragMode='deselect'
      fireEvent.mouseDown(cell1);
      fireEvent.mouseEnter(cell2);

      expect(cell1).not.toHaveClass('border-brand-500');
      expect(cell2).not.toHaveClass('border-brand-500');
    });

    test('mouseup 후 isDragging 종료 — 추가 mouseEnter는 toggle 안 함', () => {
      const { container } = render(<GuestTimeGrid {...baseProps} />);
      const cellA = container.querySelector(
        '[data-day="2026-05-24"][data-minute="540"]',
      ) as HTMLElement;
      const cellB = container.querySelector(
        '[data-day="2026-05-24"][data-minute="555"]',
      ) as HTMLElement;

      fireEvent.mouseDown(cellA);
      fireEvent.mouseUp(cellA);

      // drag 종료 후 mouseEnter는 무시
      fireEvent.mouseEnter(cellB);
      expect(cellB).not.toHaveClass('border-brand-500');
    });

    test('다른 guest_token의 votes는 본인 선택으로 인식 안 함', () => {
      const initialVotes = [
        {
          day: '2026-05-24',
          start_minute: 540,
          end_minute: 555,
          guest_token: 'other-guest',
          user_id: null,
        },
      ];
      const { container } = render(<GuestTimeGrid {...baseProps} votes={initialVotes} />);
      const cell = container.querySelector(
        '[data-day="2026-05-24"][data-minute="540"]',
      ) as HTMLElement;
      // 다른 게스트의 vote — 본인의 selectedSlots에는 들어가지 않음
      expect(cell).not.toHaveClass('border-brand-500');
    });
  });

  // ---------------------------------------------------------------------------
  // spec drift 영역 — S14-violations-fix 후 unskip + lib utils 채택 spec으로 갱신
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // S14-violations-fix unskipped — lib utils 채택 + KST/D10 정합 검증
  // ---------------------------------------------------------------------------

  describe('Heatmap 색 (D10 5-stop quartile, lib/heatmap.classifyHeat)', () => {
    // lib/heatmap.classifyHeat과 동일 quartile spec (q1=max/4, q2=max/2, q3=3·max/4).
    // 같은 (day, minute)에 다른 게스트 N명 vote → heatmapData count=N. memberCount=max.
    // 본인 토큰 vote가 아니므로 selectedSlots 미포함 → heat ramp 적용.
    function makeOtherVotes(day: string, minute: number, n: number) {
      return Array.from({ length: n }, (_, i) => ({
        day,
        start_minute: minute,
        end_minute: minute + 15,
        guest_token: `other-${i}`,
        user_id: null,
      }));
    }

    test('count=0 → heat-0 (bg-surface-3)', () => {
      const { container } = render(<GuestTimeGrid {...baseProps} memberCount={8} votes={[]} />);
      const cell = container.querySelector(
        '[data-day="2026-05-24"][data-minute="540"]',
      ) as HTMLElement;
      expect(cell).toHaveClass('bg-surface-3');
    });

    test('count=maxCount → heat-4 (bg-brand-500)', () => {
      const votes = makeOtherVotes('2026-05-24', 540, 8);
      const { container } = render(<GuestTimeGrid {...baseProps} memberCount={8} votes={votes} />);
      const cell = container.querySelector(
        '[data-day="2026-05-24"][data-minute="540"]',
      ) as HTMLElement;
      expect(cell).toHaveClass('bg-brand-500');
    });

    test('quartile q1 경계 (max=8, count=2 ≤ q1=2) → heat-1 (bg-brand-100)', () => {
      const votes = makeOtherVotes('2026-05-24', 540, 2);
      const { container } = render(<GuestTimeGrid {...baseProps} memberCount={8} votes={votes} />);
      const cell = container.querySelector(
        '[data-day="2026-05-24"][data-minute="540"]',
      ) as HTMLElement;
      expect(cell).toHaveClass('bg-brand-100');
    });

    test('quartile q2 경계 (max=8, count=4 ≤ q2=4) → heat-2 (bg-brand-200)', () => {
      const votes = makeOtherVotes('2026-05-24', 540, 4);
      const { container } = render(<GuestTimeGrid {...baseProps} memberCount={8} votes={votes} />);
      const cell = container.querySelector(
        '[data-day="2026-05-24"][data-minute="540"]',
      ) as HTMLElement;
      expect(cell).toHaveClass('bg-brand-200');
    });

    test('quartile q3 경계 (max=8, count=6 ≤ q3=6) → heat-3 (bg-brand-400)', () => {
      const votes = makeOtherVotes('2026-05-24', 540, 6);
      const { container } = render(<GuestTimeGrid {...baseProps} memberCount={8} votes={votes} />);
      const cell = container.querySelector(
        '[data-day="2026-05-24"][data-minute="540"]',
      ) as HTMLElement;
      expect(cell).toHaveClass('bg-brand-400');
    });

    test('count > 3·max/4 (max=8, count=7) → heat-4 (bg-brand-500)', () => {
      const votes = makeOtherVotes('2026-05-24', 540, 7);
      const { container } = render(<GuestTimeGrid {...baseProps} memberCount={8} votes={votes} />);
      const cell = container.querySelector(
        '[data-day="2026-05-24"][data-minute="540"]',
      ) as HTMLElement;
      expect(cell).toHaveClass('bg-brand-500');
    });

    test('본인 슬롯은 heat ramp override — border-brand-500 + bg-brand-50', () => {
      // 다른 게스트 7명 + 본인 1 vote on 같은 cell. 본인은 selectedSlots에 들어가서 override.
      const votes = [
        ...makeOtherVotes('2026-05-24', 540, 7),
        {
          day: '2026-05-24',
          start_minute: 540,
          end_minute: 555,
          guest_token: 'guest-token-123',
          user_id: null,
        },
      ];
      const { container } = render(<GuestTimeGrid {...baseProps} memberCount={8} votes={votes} />);
      const cell = container.querySelector(
        '[data-day="2026-05-24"][data-minute="540"]',
      ) as HTMLElement;
      expect(cell).toHaveClass('border-brand-500');
      expect(cell).toHaveClass('bg-brand-50');
      // heat ramp 클래스 X
      expect(cell).not.toHaveClass('bg-brand-500');
      expect(cell).not.toHaveClass('bg-surface-3');
    });
  });

  describe('KST 요일 (D13, lib/time.dayOfWeekKst)', () => {
    // luxon Asia/Seoul 기준 한국어 요일. 컴퓨터 timezone에 무관하게 일관된 결과.
    test('2026-05-25 (KST 월요일) → "월"', () => {
      render(<GuestTimeGrid {...baseProps} dates={['2026-05-25']} />);
      expect(screen.getByText('월')).toBeInTheDocument();
    });

    test('2026-05-26 (KST 화요일) → "화"', () => {
      render(<GuestTimeGrid {...baseProps} dates={['2026-05-26']} />);
      expect(screen.getByText('화')).toBeInTheDocument();
    });

    test('2026-05-31 (KST 일요일) → "일"', () => {
      render(<GuestTimeGrid {...baseProps} dates={['2026-05-31']} />);
      expect(screen.getByText('일')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 잔여 spec drift skip — 본 ship 외 범위. 별도 sub-task 필요.
  // ---------------------------------------------------------------------------

  describe.skip('Cross-day sweep — RN 사각형 spec 채택 결정 필요 (별도 sub-task)', () => {
    // 현재 `handleMouseEnterCell`은 mouse가 지난 경로 cell만 toggle (사각형 영역 미구현).
    // RN `applySweepToRecord`는 사각형 영역 (rowMin~rowMax, colMin~colMax).
    // UX 의도(경로 vs 사각형) 결정이 별도 — 결정 후 unskip + spec 정합.
    test('mousedown D1 540 → mouseEnter D2 540 → 두 셀 모두 select (경로)', () => { /* placeholder */ });
    test('mousedown D1 540 → mouseEnter D2 555 → 사각형 4셀 (RN spec)', () => { /* placeholder */ });
  });

  describe.skip('Realtime broadcast listen (D11 수신 path) — S05a payload 확정 후 unskip', () => {
    // self-broadcast send 코드는 S14-violations-fix(2026-05-26)에서 제거 완료 (D11 책임 분리).
    // broadcast `heatmap_update` 수신 시 votes 상태 refresh 검증은 S05a Edge Function payload spec
    // (D11 day_index 포함) 확정 후 별도 sub-task (mock channel.on 콜백 trigger + fetch chain mock).
    test('broadcast `heatmap_update` 수신 시 votes 상태 refresh', () => { /* placeholder */ });
  });
});
