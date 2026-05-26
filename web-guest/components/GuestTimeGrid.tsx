'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { classifyHeat, type HeatLevel } from '../lib/heatmap';
import { dayOfWeekKst, formatHeaderDate } from '../lib/time';
import { voteKey, parseVoteKey } from '../lib/voteKey';

interface Vote {
  day: string;
  start_minute: number;
  end_minute: number;
  guest_token?: string | null;
  user_id?: string | null;
}

interface GuestTimeGridProps {
  groupId: string;
  guestToken: string;
  dates: string[];
  votes: Vote[];
  memberCount: number;
  onVoteStatusChange?: (isSaving: boolean) => void;
  onVotesUpdated?: () => void;
}

const START_MINUTE = 540; // 09:00
const END_MINUTE = 1440;  // 24:00
const SLOT_SIZE = 15;     // 15 minutes
const TOTAL_SLOTS = (END_MINUTE - START_MINUTE) / SLOT_SIZE; // 60 slots

export default function GuestTimeGrid({
  groupId,
  guestToken,
  dates,
  votes: initialVotes,
  memberCount,
  onVoteStatusChange,
  onVotesUpdated,
}: GuestTimeGridProps) {
  const [votes, setVotes] = useState<Vote[]>(initialVotes);
  const [selectedSlots, setSelectedSlots] = useState<{ [key: string]: boolean }>({});
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'select' | 'deselect' | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Parse initial votes to populate guest's selection state.
  // S14-violations-fix: `setVotes(initialVotes)`은 prop→state sync로 set-state-in-effect 회피가
  // 어려운 경우. selectedSlots reset과 함께 한 effect에서 처리. broadcast refresh는 별도
  // refreshVotes에서 동일 state 갱신. 별도 state-refactor 도입 시 props 직접 사용으로 격상 후보.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVotes(initialVotes);
    const initialSelection: { [key: string]: boolean } = {};
    initialVotes.forEach((vote) => {
      if (vote.guest_token === guestToken) {
        const key = voteKey({ day: vote.day, start_minute: vote.start_minute });
        initialSelection[key] = true;
      }
    });
    setSelectedSlots(initialSelection);
  }, [initialVotes, guestToken]);

  // Aggregate heatmap data (count of voters per slot)
  const heatmapData = React.useMemo(() => {
    const counts: { [key: string]: number } = {};
    votes.forEach((vote) => {
      const key = voteKey({ day: vote.day, start_minute: vote.start_minute });
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [votes]);

  // S14-violations-fix: const declaration hoisting 불가 → useCallback로 먼저 선언 +
  // useEffect deps에 포함 (refreshVotes accessed before declared error 해소).
  const refreshVotes = useCallback(async () => {
    const { data } = await supabase
      .from('votes')
      .select('day, start_minute, end_minute, guest_token, user_id')
      .eq('group_id', groupId);
    if (data) {
      setVotes(data);
    }
  }, [groupId]);

  // Subscribe to real-time updates for heatmap updates
  useEffect(() => {
    // S14-e2e-setup: dummy supabase URL → websocket connection 영구 retry 회피.
    if (process.env.NEXT_PUBLIC_IS_E2E === 'true') return;
    const channel = supabase
      .channel(`group:${groupId}`)
      .on('broadcast', { event: 'heatmap_update' }, () => {
        // Re-fetch votes on update notification
        refreshVotes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, refreshVotes]);

  // Safe DB commit using RPC save_guest_votes
  const commitVotes = async (newSelection: { [key: string]: boolean }) => {
    if (onVoteStatusChange) onVoteStatusChange(true);

    // S14-e2e-setup: dummy supabase URL RPC hang 회피. selection만 유지 (heatmap update X).
    if (process.env.NEXT_PUBLIC_IS_E2E === 'true') {
      if (onVotesUpdated) onVotesUpdated();
      if (onVoteStatusChange) onVoteStatusChange(false);
      return;
    }

    const votePayload = Object.keys(newSelection)
      .filter((key) => newSelection[key])
      .map((key) => {
        const slot = parseVoteKey(key);
        return {
          day: slot.day,
          start_minute: slot.start_minute,
          end_minute: slot.start_minute + SLOT_SIZE,
        };
      });

    try {
      const { error } = await supabase.rpc('save_guest_votes', {
        p_group_id: groupId,
        p_guest_token: guestToken,
        p_votes: votePayload,
      });

      if (error) throw error;

      // D11: votes_aggregate Edge Function이 broadcast publisher. 클라 self-send 금지.
      if (onVotesUpdated) onVotesUpdated();
      refreshVotes();
    } catch (err) {
      console.error('Failed to save votes:', err);
    } finally {
      if (onVoteStatusChange) onVoteStatusChange(false);
    }
  };

  const debouncedCommit = (newSelection: { [key: string]: boolean }) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      commitVotes(newSelection);
    }, 100); // 100ms debounce
  };

  // Find slot under touch/mouse coordinate
  const getSlotFromCoords = (clientX: number, clientY: number) => {
    const element = document.elementFromPoint(clientX, clientY);
    if (!element) return null;

    const cell = element.closest('[data-slot-cell]');
    if (!cell) return null;

    const day = cell.getAttribute('data-day');
    const startMinute = cell.getAttribute('data-minute');

    if (!day || !startMinute) return null;

    const minute = parseInt(startMinute, 10);
    return {
      day,
      minute,
      key: voteKey({ day, start_minute: minute }),
    };
  };

  const handleCellAction = (key: string, forceMode?: 'select' | 'deselect') => {
    const isSelected = selectedSlots[key];
    const mode = forceMode || (isSelected ? 'deselect' : 'select');

    setSelectedSlots((prev) => {
      const updated = { ...prev };
      if (mode === 'select') {
        updated[key] = true;
      } else {
        delete updated[key];
      }
      debouncedCommit(updated);
      return updated;
    });

    return mode;
  };

  // Touch handlers (Mobile/Tablet)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    if (!touch) return;
    const slot = getSlotFromCoords(touch.clientX, touch.clientY);
    if (!slot) return;

    setIsDragging(true);
    const mode = handleCellAction(slot.key);
    setDragMode(mode);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !dragMode || e.touches.length === 0) return;
    const touch = e.touches[0];
    if (!touch) return;
    const slot = getSlotFromCoords(touch.clientX, touch.clientY);
    if (!slot) return;

    handleCellAction(slot.key, dragMode);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setDragMode(null);
  };

  // Mouse handlers (Desktop fallback/previews)
  const handleMouseDown = (day: string, minute: number) => {
    const key = voteKey({ day, start_minute: minute });
    setIsDragging(true);
    const mode = handleCellAction(key);
    setDragMode(mode);
  };

  const handleMouseEnterCell = (day: string, minute: number) => {
    if (!isDragging || !dragMode) return;
    const key = voteKey({ day, start_minute: minute });
    handleCellAction(key, dragMode);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragMode(null);
  };

  // Clean timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Format minutes into HH:MM representation
  const formatTime = (minutes: number) => {
    const hour = Math.floor(minutes / 60);
    const min = minutes % 60;
    return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  };

  // D10 5-stop ramp — lib/heatmap.classifyHeat (RN src/lib/heatmap/classify.ts와 동일 quartile spec)
  const heatLevelToClass = (level: HeatLevel): string => {
    switch (level) {
      case 'heat-0':
        return 'bg-surface-3 dark:bg-surface-3';
      case 'heat-1':
        return 'bg-brand-100 dark:bg-brand-100';
      case 'heat-2':
        return 'bg-brand-200 dark:bg-brand-300';
      case 'heat-3':
        return 'bg-brand-400 dark:bg-brand-400';
      case 'heat-4':
        return 'bg-brand-500 dark:bg-brand-500';
    }
  };

  const getHeatClass = (count: number) => heatLevelToClass(classifyHeat(count, memberCount));

  return (
    <div className="flex flex-col select-none w-full">
      {/* Grid Header */}
      <div className="flex border-b border-border-subtle pb-2">
        <div className="w-14 shrink-0" />
        <div className="flex flex-1 justify-between">
          {dates.map((date) => (
            <div key={date} className="flex-1 text-center">
              <div className="text-xs text-text-tertiary">{dayOfWeekKst(date)}</div>
              <div className="text-sm font-semibold text-text-primary">
                {formatHeaderDate(date)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid Body */}
      <div
        ref={gridRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseLeave={handleMouseUp}
        onMouseUp={handleMouseUp}
        className="flex flex-1 overflow-y-auto max-h-[600px] py-4 touch-none"
      >
        {/* Hour Labels */}
        <div className="w-14 shrink-0 flex flex-col justify-between pr-2 text-right">
          {Array.from({ length: 16 }).map((_, index) => {
            const min = START_MINUTE + index * 60;
            return (
              <div
                key={min}
                className="text-[11px] font-medium text-text-tertiary h-[24px] flex items-center justify-end font-sans font-variant-tabular-nums"
                style={{ height: '32px' }}
              >
                {formatTime(min)}
              </div>
            );
          })}
        </div>

        {/* Grid Cells Columns */}
        <div className="flex flex-1 justify-between relative gap-1">
          {dates.map((day) => (
            <div key={day} className="flex-1 flex flex-col justify-between h-[512px]">
              {Array.from({ length: TOTAL_SLOTS }).map((_, index) => {
                const minute = START_MINUTE + index * SLOT_SIZE;
                const key = voteKey({ day, start_minute: minute });
                const isSelected = selectedSlots[key];
                const count = heatmapData[key] || 0;

                return (
                  <div
                    key={minute}
                    data-slot-cell
                    data-day={day}
                    data-minute={minute}
                    onMouseDown={() => handleMouseDown(day, minute)}
                    onMouseEnter={() => handleMouseEnterCell(day, minute)}
                    className={`h-[7px] w-full border border-transparent transition-all rounded-xs cursor-pointer ${
                      isSelected
                        ? 'bg-brand-50 border-2 border-brand-500'
                        : getHeatClass(count)
                    }`}
                    style={{
                      touchAction: 'none',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap Legend */}
      <div className="flex items-center justify-end gap-2 mt-4 text-xs text-text-secondary pr-1">
        <span>비어있음</span>
        <div className="w-3 h-3 bg-surface-3 rounded-xs" />
        <div className="w-3 h-3 bg-brand-100 rounded-xs" />
        <div className="w-3 h-3 bg-brand-200 dark:bg-brand-300 rounded-xs" />
        <div className="w-3 h-3 bg-brand-400 rounded-xs" />
        <div className="w-3 h-3 bg-brand-500 rounded-xs" />
        <span>가득참</span>
      </div>
    </div>
  );
}
