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

  describe.skip('Heatmap 색 (D10 5-stop) — S14-violations-fix 후 unskip', () => {
    // 현재 컴포넌트 `getHeatClass`: ratio 기준 (>=0.99/0.75/0.50/else heat-1).
    // 목표 spec: RN `src/lib/heatmap/classify.ts::classifyHeat` quartile (q1/q2/q3).
    // 예: 7명 모임 count=2 → 현재 ratio=0.286 = heat-1, quartile q1=1.75 = heat-2 (drift).
    // unskip 시점에 lib/heatmap.classifyHeat을 컴포넌트가 채택했는지 검증 + 임계값 케이스 추가.
    test('count=0 → heat-0 (bg-surface-3)', () => { /* placeholder */ });
    test('count=maxCount → heat-4 (bg-brand-500)', () => { /* placeholder */ });
    test('quartile q1 경계 (count≤max/4) → heat-1', () => { /* placeholder */ });
    test('quartile q2 경계 (max/4 < count ≤ max/2) → heat-2', () => { /* placeholder */ });
    test('quartile q3 경계 (max/2 < count ≤ 3·max/4) → heat-3', () => { /* placeholder */ });
    test('count > 3·max/4 → heat-4', () => { /* placeholder */ });
    test('본인 슬롯은 heat ramp가 아닌 border-brand-500 override', () => { /* placeholder */ });
  });

  describe.skip('KST 요일 (D13) — S14-violations-fix 후 unskip', () => {
    // 현재 컴포넌트: `new Date(dateStr).getDay()` — local timezone 의존 (jsdom 기본 UTC).
    // 목표 spec: `lib/time.dayOfWeekKst` (luxon Asia/Seoul). 컴퓨터 timezone 무관 일관.
    // unskip 시점에 컴포넌트가 dayOfWeekKst 채택 후 한국어 요일 검증.
    test('2026-05-25 (KST 월요일) → "월"', () => { /* placeholder */ });
    test('2026-05-26 (KST 화요일) → "화"', () => { /* placeholder */ });
    test('2026-05-31 (KST 일요일) → "일"', () => { /* placeholder */ });
  });

  describe.skip('Cross-day sweep — S14-violations-fix 후 spec 확정 + unskip', () => {
    // 현재 `handleMouseEnterCell`은 day를 받아 (day, minute) 키 생성 → 다일 cross 자동 작동.
    // 다만 UX 의도(같은 시간대 cross-day vs row span vs 사각형 영역)가 모호.
    // unskip 시점에 RN sweep `applySweepToRecord`의 사각형 영역 spec과 정합 검증.
    test('mousedown D1 540 → mouseEnter D2 540 → 두 셀 모두 select', () => { /* placeholder */ });
    test('mousedown D1 540 → mouseEnter D2 555 → 사각형 4셀 모두 select (RN sweep과 정합)', () => { /* placeholder */ });
  });

  describe.skip('Realtime broadcast (D11) — S14-violations-fix 후 unskip', () => {
    // 현재 컴포넌트: commitVotes 마지막에 `supabase.channel(...).send({event: 'heatmap_update'})` self-broadcast.
    // D11 위반 — Edge Function `votes_aggregate` (S05a)가 broadcast publisher. 클라는 listen만.
    // unskip 시점에 self-broadcast 제거 검증 + Edge Function broadcast 수신 시 cell 업데이트 검증.
    test('client는 broadcast send 호출 안 함 (D11 책임 위반 회피)', () => { /* placeholder */ });
    test('broadcast `heatmap_update` 수신 시 votes 상태 refresh', () => { /* placeholder */ });
  });
});
