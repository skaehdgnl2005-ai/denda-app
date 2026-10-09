'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getGuestGroupView, type GuestVote, type HeatmapSlot } from '../../../lib/guestApi';
import { logAttributionClick } from '../../../lib/attribution';
import NicknameForm from '../../../components/NicknameForm';
import GuestTimeGrid from '../../../components/GuestTimeGrid';

interface ClientPageProps {
  groupId: string;
  groupName: string;
  dates: string[];
  hostNickname: string;
  token: string;
}

interface Participant {
  name: string;
  isMember: boolean;
  hasVoted: boolean;
}

export default function ClientPage({
  groupId,
  groupName,
  dates,
  hostNickname,
  token,
}: ClientPageProps) {
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [, setGuestNickname] = useState<string | null>(null);
  const [votes, setVotes] = useState<GuestVote[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapSlot[]>([]);
  const fetchSequence = useRef(0);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedToken, setLoadedToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch initial votes and members
  const fetchData = useCallback(async () => {
    const sequence = ++fetchSequence.current;
    // S14-e2e-setup: dummy supabase URL fetch hang 회피. supabase 호출 skip + 즉시 loading 해제.
    if (process.env.NEXT_PUBLIC_IS_E2E === 'true') {
      setLoadedToken(guestToken);
      setVotes([]);
      setParticipants([]);
      setLoading(false);
      return;
    }
    try {
      const view = await getGuestGroupView(groupId, guestToken);
      if (!view || sequence !== fetchSequence.current) return;
      setLoadedToken(guestToken);
      setVotes(view.votes);
      setHeatmap(view.heatmap);
      setParticipants(view.participants);
    } catch (err) {
      console.error('Error fetching grid data:', err);
    } finally {
      if (sequence === fetchSequence.current) setLoading(false);
    }
  }, [groupId, guestToken]);

  useEffect(() => {
    // S14-e2e-setup: fetchData()는 prop→state sync 패턴. setVotes/setParticipants/setLoading
    // 모두 effect 안. 별도 state-refactor로 격상 후보.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    const invalidate = () => { fetchSequence.current++; };
    return invalidate;
  }, [fetchData]);

  const handleNicknameComplete = (guestTokenValue: string, nickname: string) => {
    setGuestToken(guestTokenValue);
    setGuestNickname(nickname);
    // D28 attribution click_log — silent (실패해도 투표 진행)
    if (process.env.NEXT_PUBLIC_IS_E2E !== 'true') {
      void logAttributionClick({
        branchLinkId: token,
        groupId,
        guestToken: guestTokenValue,
      });
    }
    // guestToken 변경 후 effect가 본인 슬롯까지 다시 조회한다.
  };

  const handleShare = async () => {
    try {
      const shareUrl = window.location.href;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  return (
    <>
      {/* Desktop Blocker */}
      <div className="hidden md:flex fixed inset-0 flex-col items-center justify-center p-6 bg-surface-0 dark:bg-surface-0 text-center select-none">
        <div className="max-w-xs space-y-4">
          <div className="text-5xl">📱</div>
          <h1 className="text-xl font-bold text-text-primary">모바일에서 열어주세요</h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            된다 모임 시간 투표는 모바일 화면에 최적화되어 있습니다. 모바일 또는 태블릿 기기로
            접속해 주세요.
          </p>
        </div>
      </div>

      {/* Mobile Page Content */}
      <div className="block md:hidden min-h-screen bg-surface-0 dark:bg-surface-0 text-text-primary px-4 py-6 font-sans">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-brand-50 text-text-brand border border-brand-100 rounded-pill">
              초대장
            </span>
            {saving && (
              <span className="text-[11px] text-text-secondary animate-pulse">투표 저장 중...</span>
            )}
          </div>
          <h1 className="text-xl font-bold text-text-primary mb-1">{groupName}</h1>
          <div className="text-xs text-text-tertiary flex items-center gap-2">
            <span>방장: {hostNickname}</span>
            <span>•</span>
            <span>참여자 {participants.length}명</span>
          </div>
        </header>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="space-y-6 animate-pulse">
            <div className="h-6 w-1/3 bg-surface-3 rounded-md" />
            <div className="h-[400px] w-full bg-surface-3 rounded-lg" />
            <div className="h-20 w-full bg-surface-3 rounded-lg" />
          </div>
        ) : (
          <>
            {/* Nickname Form Modal */}
            <NicknameForm groupId={groupId} onComplete={handleNicknameComplete} />

            {/* Main Interactive Grid */}
            {guestToken && loadedToken === guestToken && (
              <div className="mb-6 rounded-lg border border-border-subtle bg-surface-1 dark:bg-surface-1 p-4 shadow-xs">
                <div className="text-xs font-semibold text-text-secondary mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-brand-500 rounded-full" />
                  드래그하여 본인의 가능 시간을 모두 선택해 주세요
                </div>
                <GuestTimeGrid
                  groupId={groupId}
                  guestToken={guestToken}
                  dates={dates}
                  votes={votes}
                  heatmap={heatmap}
                  memberCount={participants.length}
                  onVoteStatusChange={setSaving}
                  onVotesUpdated={fetchData}
                />
              </div>
            )}

            {/* Participant Status */}
            <section className="mb-6 rounded-lg border border-border-subtle bg-surface-2 p-4">
              <h2 className="text-sm font-semibold text-text-primary mb-3">참여자 현황</h2>
              <div className="flex flex-wrap gap-2">
                {participants.map((p, idx) => (
                  <div
                    key={idx}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                      p.hasVoted
                        ? 'bg-brand-50 text-text-brand border border-brand-100'
                        : 'bg-surface-3 text-text-secondary'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        p.hasVoted ? 'bg-brand-500' : 'bg-text-disabled'
                      }`}
                    />
                    {p.name}
                    {!p.isMember && (
                      <span className="text-[10px] text-text-tertiary">(게스트)</span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Kakao Share & CTA */}
            <section className="mt-8 text-center space-y-4">
              <p className="text-xs text-text-secondary leading-relaxed px-4">
                투표가 끝나면 링크를 공유해 친구들에게 투표 독려 알림을 받아보세요.
              </p>
              <button
                id="share-button"
                onClick={handleShare}
                className="w-full h-12 bg-kakao-yellow hover:bg-kakao-yellow-hover text-kakao-dark font-bold rounded-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>💬</span>
                {copied ? '초대 링크가 복사되었습니다!' : '결과 알림 받으려면 → 카톡 공유'}
              </button>
            </section>
          </>
        )}
      </div>
    </>
  );
}
