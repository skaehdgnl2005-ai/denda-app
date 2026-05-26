import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import ClientPage from './ClientPage';

interface Props {
  params: Promise<{
    token: string;
  }>;
}

async function getGroup(groupId: string) {
  if (process.env.NEXT_PUBLIC_IS_E2E === 'true') {
    return {
      id: groupId,
      name: '안암 저녁 모임',
      dates: ['2026-05-24', '2026-05-25'],
      host_id: 'host-123',
      users: { nickname: '김방장' },
    };
  }

  try {
    const { data: group, error } = await supabase
      .from('groups')
      .select('id, name, dates, host_id, users!groups_host_id_fkey(nickname)')
      .eq('id', groupId)
      .single();

    if (error || !group) return null;
    return group;
  } catch (err) {
    console.error('Error fetching group:', err);
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const group = await getGroup(token);
  if (!group) {
    return {
      title: '모임을 찾을 수 없습니다 - 된다',
    };
  }

  const hostNickname = (group as { users?: { nickname?: string } }).users?.nickname || '친구';
  const title = `${group.name} | 모임 시간 투표 - 된다`;
  const description = `${hostNickname}님이 모임에 초대했습니다. 가능 시간을 드래그해서 선택해 주세요.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://denda.vercel.app/g/${token}`,
      siteName: '된다 (DenDa)',
      images: [
        {
          url: 'https://vsnqwyabvtgclbxpiuyg.supabase.co/storage/v1/object/public/assets/og_image.png',
          width: 800,
          height: 400,
          alt: '된다 모임 초대장',
        },
      ],
    },
  };
}

export default async function Page({ params }: Props) {
  const { token } = await params;
  const group = await getGroup(token);
  if (!group) {
    notFound();
  }

  return (
    <ClientPage
      groupId={group.id}
      groupName={group.name}
      dates={group.dates}
      hostNickname={(group as { users?: { nickname?: string } }).users?.nickname || '방장'}
    />
  );
}
