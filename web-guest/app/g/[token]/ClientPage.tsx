'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import NicknameForm from '../../../components/NicknameForm';
import GuestTimeGrid from '../../../components/GuestTimeGrid';

interface ClientPageProps {
  groupId: string;
  groupName: string;
  dates: string[];
  hostNickname: string;
}

interface Vote {
  day: string;
  start_minute: number;
  end_minute: number;
  guest_token?: string | null;
  user_id?: string | null;
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
}: ClientPageProps) {
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [guestNickname, setGuestNickname] = useState<string | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch initial votes and members
  const fetchData = async () => {
    try {
      // 1. Fetch votes
      const { data: votesData } = await supabase
        .from('votes')
        .select('day, start_minute, end_minute, guest_token, user_id')
        .eq('group_id', groupId);

      // 2. Fetch members
      const { data: membersData } = await supabase
        .from('group_members')
        .select('joined_at, user:users(id, nickname)')
        .eq('group_id', groupId);

      // 3. Fetch guests
      const { data: guestsData } = await supabase
        .from('group_guests')
        .select('guest_token, nickname')
        .eq('group_id', groupId);

      const fetchedVotes = votesData || [];
      setVotes(fetchedVotes);

      // Determine who has voted (has at least 1 vote row)
      const voters = new Set<string>();
      fetchedVotes.forEach((v) => {
        if (v.user_id) voters.add(v.user_id);
        if (v.guest_token) voters.add(v.guest_token);
      });

      // Build participant status list
      const list: Participant[] = [];

      // Add members
      if (membersData) {
        membersData.forEach((m: any) => {
          if (m.user) {
            list.push({
              name: m.user.nickname,
              isMember: true,
              hasVoted: voters.has(m.user.id),
            });
          }
        });
      }

      // Add guests
      if (guestsData) {
        guestsData.forEach((g) => {
          list.push({
            name: g.nickname,
            isMember: false,
            hasVoted: voters.has(g.guest_token),
          });
        });
      }

      setParticipants(list);
    } catch (err) {
      console.error('Error fetching grid data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [groupId]);

  const handleNicknameComplete = (token: string, nickname: string) => {
    setGuestToken(token);
    setGuestNickname(nickname);
    fetchData(); // Refresh list to include self
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
            된다 모임 시간 투표는 모바일 화면에 최적화되어 있습니다. 모바일 또는 태블릿 기기로 접속해 주세요.
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
              <span className="text-[11px] text-text-secondary animate-pulse">
                투표 저장 중...
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-text-primary mb-1">
            {groupName}
          </h1>
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
            {guestToken && (
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
                  memberCount={participants.length}
                  onVoteStatusChange={setSaving}
                  onVotesUpdated={fetchData}
                />
              </div>
            )}

            {/* Participant Status */}
            <section className="mb-6 rounded-lg border border-border-subtle bg-surface-2 p-4">
              <h2 className="text-sm font-semibold text-text-primary mb-3">
                참여자 현황
              </h2>
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
                    {!p.isMember && <span className="text-[10px] text-text-tertiary">(게스트)</span>}
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
