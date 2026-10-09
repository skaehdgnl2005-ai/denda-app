import { supabase } from './supabase';

export interface GuestVote {
  day: string;
  start_minute: number;
  end_minute: number;
  is_own: boolean;
}
export interface HeatmapSlot {
  day: string;
  start_minute: number;
  count: number;
}
export interface GuestGroupView {
  id: string;
  name: string;
  dates: string[];
  users: { nickname: string };
  participants: { guest_id?: string; name: string; isMember: boolean; hasVoted: boolean }[];
  votes: GuestVote[];
  heatmap: HeatmapSlot[];
}
export async function getGuestGroupView(groupId: string, guestToken: string | null = null): Promise<GuestGroupView | null> {
  const { data, error } = await supabase.rpc('get_guest_group_view', {
    p_group_id: groupId, p_guest_token: guestToken,
  });
  if (error) throw error;
  return data;
}
export async function getGuestSession(groupId: string, guestToken: string): Promise<{ guest_id: string; nickname: string } | null> {
  const { data, error } = await supabase.rpc('get_guest_session', {
    p_group_id: groupId, p_guest_token: guestToken,
  });
  if (error) throw error;
  return data;
}
export async function registerGuest(groupId: string, nickname: string): Promise<{ guest_token: string; guest_id: string; nickname: string }> {
  const { data, error } = await supabase.rpc('register_guest', {
    p_group_id: groupId, p_nickname: nickname,
  });
  if (error) throw error;
  return data;
}
