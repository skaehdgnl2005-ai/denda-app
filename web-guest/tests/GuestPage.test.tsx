import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import ClientPage from '../app/g/[token]/ClientPage';
import { getGuestGroupView, getGuestSession } from '../lib/guestApi';
jest.mock('../lib/guestApi', () => ({ getGuestGroupView: jest.fn(), getGuestSession: jest.fn() }));
jest.mock('../lib/attribution', () => ({ logAttributionClick: jest.fn() }));
jest.mock('../components/GuestTimeGrid', () => ({
  __esModule: true,
  default: ({ votes, heatmap }: { votes: unknown[]; heatmap: unknown[] }) =>
    <div data-testid="grid">{JSON.stringify({ votes, heatmap })}</div>,
}));
const view = getGuestGroupView as jest.Mock;
const session = getGuestSession as jest.Mock;
const publicView = { id: 'group', name: '모임', dates: ['2026-10-10'], users: { nickname: '방장' }, participants: [], votes: [], heatmap: [] };
afterEach(() => { localStorage.clear(); jest.clearAllMocks(); });
test('returning guest grid waits for own selection instead of exposing an empty editable grid', async () => {
  localStorage.setItem('denda_guest_token_group', 'secret');
  session.mockResolvedValue({ guest_id: 'public-id', nickname: '손님' });
  let restore!: (value: unknown) => void;
  view.mockImplementation((_group, token) => token
    ? new Promise(resolve => { restore = resolve; })
    : Promise.resolve(publicView));
  render(<ClientPage groupId="group" groupName="모임" dates={['2026-10-10']} hostNickname="방장" token="group" />);
  await waitFor(() => expect(view).toHaveBeenCalledWith('group', 'secret'));
  expect(screen.queryByTestId('grid')).toBeNull();
  await act(async () => restore({ ...publicView,
    votes: [{ day: '2026-10-10', start_minute: 540, end_minute: 555, is_own: true }],
    heatmap: [{ day: '2026-10-10', start_minute: 540, count: 2 }],
  }));
  expect(await screen.findByTestId('grid')).toHaveTextContent('"is_own":true');
  expect(screen.getByTestId('grid')).toHaveTextContent('"count":2');
  expect(screen.getByTestId('grid')).not.toHaveTextContent('guest_token');
});
