import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NicknameForm from '../components/NicknameForm';
import { getGuestSession, registerGuest } from '../lib/guestApi';
jest.mock('../lib/guestApi', () => ({ getGuestSession: jest.fn(), registerGuest: jest.fn() }));
const session = getGuestSession as jest.Mock;
const register = registerGuest as jest.Mock;
beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); });
test('returning guest restores nickname with group-scoped secret', async () => {
  localStorage.setItem('denda_guest_token_group', 'secret');
  session.mockResolvedValue({ guest_id: 'public-id', nickname: '기존 손님' });
  const complete = jest.fn();
  render(<NicknameForm groupId="group" onComplete={complete} />);
  await waitFor(() => expect(complete).toHaveBeenCalledWith('secret', '기존 손님'));
  expect(session).toHaveBeenCalledWith('group', 'secret');
  expect(register).not.toHaveBeenCalled();
});
test('new guest stores only the credential returned by registration', async () => {
  register.mockResolvedValue({ guest_token: 'new-secret', guest_id: 'public-id', nickname: '새 손님' });
  const complete = jest.fn();
  render(<NicknameForm groupId="group" onComplete={complete} />);
  fireEvent.change(await screen.findByPlaceholderText('닉네임 입력'), { target: { value: '새 손님' } });
  fireEvent.click(screen.getByText('확인'));
  await waitFor(() => expect(complete).toHaveBeenCalledWith('new-secret', '새 손님'));
  expect(register).toHaveBeenCalledWith('group', '새 손님');
  expect(localStorage.getItem('denda_guest_token_group')).toBe('new-secret');
});
test('invalid stored credential opens registration', async () => {
  localStorage.setItem('denda_guest_token_group', 'invalid');
  session.mockResolvedValue(null);
  render(<NicknameForm groupId="group" onComplete={jest.fn()} />);
  expect(await screen.findByPlaceholderText('닉네임 입력')).toBeVisible();
  expect(localStorage.getItem('denda_guest_token_group')).toBeNull();
});
test('temporary lookup failure preserves credential and prevents duplicate registration', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.setItem('denda_guest_token_group', 'secret');
  session.mockRejectedValue(new Error('offline'));
  render(<NicknameForm groupId="group" onComplete={jest.fn()} />);
  expect(await screen.findByText('연결하지 못했어요. 새로고침해 다시 시도해 주세요.')).toBeVisible();
  expect(localStorage.getItem('denda_guest_token_group')).toBe('secret');
  expect(screen.getByRole('button')).toBeDisabled();
  log.mockRestore();
});
