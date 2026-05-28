// S22 — group_invitations 클라 API (supabase).
// 책임: 인앱 모임 초대 createInvitation / listMyInvitations / acceptInvitation / rejectInvitation
// RLS 통과 패턴:
//   - INSERT(0002 group_invitations_insert_as_inviter): inviter_id=auth.uid() + NOT is_blocked
//   - SELECT(0005 group_invitations_select_involving_self): auth.uid()=inviter_id OR =invitee_id + 차단 hide(D16)
//   - UPDATE(0002 group_invitations_update_invitee): auth.uid()=invitee_id
// acceptInvitation은 0020 accept_group_invitation RPC로 atomic 처리 (status UPDATE + group_members INSERT).

import { supabase } from '@/lib/supabase/client';

export interface InvitationGroup {
  id: string;
  name: string;
}

export interface InvitationInviter {
  id: string;
  nickname: string;
  avatar_url?: string;
}

export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface GroupInvitation {
  id: string;
  group_id: string;
  inviter_id: string;
  invitee_id: string;
  status: InvitationStatus;
  created_at: string; // UTC ISO
  group?: InvitationGroup;
  inviter?: InvitationInviter;
}

interface InvitationGroupRow {
  id: string;
  name: string;
}

interface InvitationInviterRow {
  id: string;
  nickname: string;
  avatar_url: string | null;
}

interface InvitationRow {
  id: string;
  group_id: string;
  inviter_id: string;
  invitee_id: string;
  status: InvitationStatus;
  created_at: string;
  group?: InvitationGroupRow | InvitationGroupRow[] | null;
  inviter?: InvitationInviterRow | InvitationInviterRow[] | null;
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) {
    throw new Error('로그인이 필요해요.');
  }
  return data.user.id;
}

function pickJoinRow<T>(row: T | T[] | null | undefined): T | null {
  if (!row) return null;
  return Array.isArray(row) ? (row[0] ?? null) : row;
}

function mapInviterRow(row: InvitationInviterRow | null): InvitationInviter | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    nickname: row.nickname,
    avatar_url: row.avatar_url ?? undefined,
  };
}

function mapGroupRow(row: InvitationGroupRow | null): InvitationGroup | undefined {
  if (!row) return undefined;
  return { id: row.id, name: row.name };
}

export const invitationsApi = {
  createInvitation: async ({
    groupId,
    inviteeId,
  }: {
    groupId: string;
    inviteeId: string;
  }): Promise<void> => {
    const gid = groupId.trim();
    const target = inviteeId.trim();
    if (!gid || !target) {
      throw new Error('모임과 친구가 필요해요.');
    }
    const me = await requireUserId();

    const { error } = await supabase
      .from('group_invitations')
      .insert({ group_id: gid, inviter_id: me, invitee_id: target });

    if (error) {
      if (error.code === '23505' || /duplicate key/i.test(error.message ?? '')) {
        throw new Error('이미 초대했어요.');
      }
      throw new Error('초대를 보내지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  },

  listMyInvitations: async (): Promise<GroupInvitation[]> => {
    const me = await requireUserId();
    const { data, error } = await supabase
      .from('group_invitations')
      .select(
        'id, group_id, inviter_id, invitee_id, status, created_at, group:group_id(id, name), inviter:inviter_id(id, nickname, avatar_url)',
      )
      .eq('invitee_id', me)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('모임 초대를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    }

    const rows = (data ?? []) as InvitationRow[];
    return rows.map((r) => ({
      id: r.id,
      group_id: r.group_id,
      inviter_id: r.inviter_id,
      invitee_id: r.invitee_id,
      status: r.status,
      created_at: r.created_at,
      group: mapGroupRow(pickJoinRow(r.group)),
      inviter: mapInviterRow(pickJoinRow(r.inviter)),
    }));
  },

  acceptInvitation: async (invitationId: string): Promise<{ groupId: string }> => {
    const id = invitationId.trim();
    if (!id) {
      throw new Error('초대를 선택해주세요.');
    }

    const { data, error } = await supabase.rpc('accept_group_invitation', {
      p_invitation_id: id,
    });

    if (error) {
      const msg = error.message ?? '';
      if (/invitation_not_found/i.test(msg)) {
        throw new Error('없는 초대예요.');
      }
      if (/invitation_not_pending/i.test(msg)) {
        throw new Error('이미 처리된 초대예요.');
      }
      // not_invitee / blocked / 그 외 모두 동일 한국어 surface
      throw new Error('수락하지 못했어요. 잠시 후 다시 시도해주세요.');
    }

    return { groupId: String(data ?? '') };
  },

  rejectInvitation: async (invitationId: string): Promise<void> => {
    const id = invitationId.trim();
    if (!id) {
      throw new Error('초대를 선택해주세요.');
    }
    const me = await requireUserId();

    const { error } = await supabase
      .from('group_invitations')
      .update({ status: 'rejected' })
      .eq('id', id)
      .eq('invitee_id', me)
      .eq('status', 'pending');

    if (error) {
      throw new Error('거절하지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  },
};
