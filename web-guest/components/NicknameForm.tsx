'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface NicknameFormProps {
  groupId: string;
  onComplete: (guestToken: string, nickname: string) => void;
}

export default function NicknameForm({ groupId, onComplete }: NicknameFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // S14-violations-fix: onComplete은 parent 매 render마다 새 reference (useCallback 미사용).
  // useEffect deps에 두면 parent re-render마다 effect 재실행 → 불필요한 supabase select 반복.
  // ref로 항상 최신 callback에 접근하면서 deps에서 제외.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    // S14-e2e-setup: dummy supabase URL fetch hang 회피. localStorage check 후 즉시 모달 표시.
    if (process.env.NEXT_PUBLIC_IS_E2E === 'true') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(true);
      return;
    }
    const checkExistingGuest = async () => {
      const storedToken = localStorage.getItem(`denda_guest_token_${groupId}`);
      if (storedToken) {
        try {
          const { data, error } = await supabase
            .from('group_guests')
            .select('nickname')
            .eq('guest_token', storedToken)
            .single();

          if (data && !error) {
            onCompleteRef.current(storedToken, data.nickname);
            return;
          }
        } catch (e) {
          console.error(e);
        }
        // Clear invalid token
        localStorage.removeItem(`denda_guest_token_${groupId}`);
      }
      setIsOpen(true);
    };

    checkExistingGuest();
  }, [groupId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError('닉네임을 입력해 주세요.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const { data, error: insertError } = await supabase
        .from('group_guests')
        .insert({
          group_id: groupId,
          nickname: nickname.trim(),
        })
        .select('guest_token')
        .single();

      if (insertError) {
        throw insertError;
      }

      if (data) {
        const token = data.guest_token;
        localStorage.setItem(`denda_guest_token_${groupId}`, token);
        setIsOpen(false);
        onComplete(token, nickname.trim());
      }
    } catch (err) {
      setError('등록하지 못했어요. 다시 시도해 주세요.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 transition-opacity duration-200">
      <div className="w-full max-w-sm rounded-xl border border-border-subtle bg-surface-0 dark:bg-surface-2 p-6 shadow-xl transition-all scale-100">
        <h2 className="text-lg font-semibold text-text-primary mb-2">
          투표 참여하기
        </h2>
        <p className="text-sm text-text-secondary mb-4">
          모임에 표시될 닉네임을 입력해 주세요.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              id="nickname-input"
              type="text"
              placeholder="닉네임 입력"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-4 py-3 text-base text-text-primary bg-surface-2 dark:bg-surface-3 border border-border-strong rounded-sm focus:outline-hidden focus:border-border-focus transition-colors"
              maxLength={20}
              disabled={loading}
            />
            {error && (
              <p className="text-xs text-error-fg mt-2 font-medium">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-brand-500 hover:bg-brand-600 disabled:bg-surface-3 disabled:text-text-disabled text-text-inverse font-semibold rounded-md flex items-center justify-center transition-colors cursor-pointer"
          >
            {loading ? '등록하는 중...' : '확인'}
          </button>
        </form>
      </div>
    </div>
  );
}
