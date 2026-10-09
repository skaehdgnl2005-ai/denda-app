import { supabase } from './supabase';
import { getGuestGroupView, registerGuest, getGuestSession } from './guestApi';
jest.mock('./supabase', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }));
const rpc = supabase.rpc as jest.Mock;
beforeEach(() => jest.clearAllMocks());
test('public view uses a group-scoped RPC and never direct table reads', async () => {
  rpc.mockResolvedValue({ data: { id: 'group', votes: [], heatmap: [] }, error: null });
  await getGuestGroupView('group');
  expect(rpc).toHaveBeenCalledWith('get_guest_group_view', { p_group_id: 'group', p_guest_token: null });
  expect(supabase.from).not.toHaveBeenCalled();
});
test('re-entry supplies the secret only to a scoped RPC', async () => {
  rpc.mockResolvedValue({ data: { guest_id: 'public-id', nickname: '손님' }, error: null });
  await getGuestSession('group', 'secret');
  expect(rpc).toHaveBeenCalledWith('get_guest_session', { p_group_id: 'group', p_guest_token: 'secret' });
  await getGuestGroupView('group', 'secret');
  expect(rpc).toHaveBeenLastCalledWith('get_guest_group_view', { p_group_id: 'group', p_guest_token: 'secret' });
  expect(supabase.from).not.toHaveBeenCalled();
});
test('registration never accepts a caller-chosen token', async () => {
  rpc.mockResolvedValue({ data: { guest_token: 'secret' }, error: null });
  expect((await registerGuest('group','손님')).guest_token).toBe('secret');
  expect(rpc).toHaveBeenCalledWith('register_guest', { p_group_id: 'group', p_nickname: '손님' });
});
test('server errors propagate instead of clearing saved state', async () => {
  rpc.mockResolvedValue({ data: null, error: new Error('offline') });
  await expect(getGuestGroupView('group','secret')).rejects.toThrow('offline');
  await expect(getGuestSession('group','secret')).rejects.toThrow('offline');
  await expect(registerGuest('group','손님')).rejects.toThrow('offline');
});
