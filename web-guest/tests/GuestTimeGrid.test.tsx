import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import GuestTimeGrid from '../components/GuestTimeGrid';

// Mock Supabase client
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockImplementation(() => Promise.resolve({ data: [] })),
      eq: jest.fn().mockImplementation(() => Promise.resolve({ data: [] })),
    })),
    rpc: jest.fn().mockImplementation(() => Promise.resolve({ error: null })),
    channel: jest.fn().mockImplementation(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
    removeChannel: jest.fn(),
  },
}));

describe('GuestTimeGrid Cell Toggle Logic', () => {
  const mockProps = {
    groupId: 'group-123',
    guestToken: 'guest-token-123',
    dates: ['2026-05-24', '2026-05-25'],
    votes: [],
    memberCount: 2,
    onVoteStatusChange: jest.fn(),
    onVotesUpdated: jest.fn(),
  };

  test('should render grid header dates correctly', () => {
    render(<GuestTimeGrid {...mockProps} />);
    
    // Check if dates are rendered
    expect(screen.getByText('5/24')).toBeInTheDocument();
    expect(screen.getByText('5/25')).toBeInTheDocument();
  });

  test('should toggle cell selection on mousedown', () => {
    const { container } = render(<GuestTimeGrid {...mockProps} />);
    
    // Find the first cell (Day 1, 09:00 slot = minute 540)
    const cell = container.querySelector('[data-day="2026-05-24"][data-minute="540"]');
    expect(cell).toBeInTheDocument();
    
    // Verify initial selection class is NOT present
    expect(cell).not.toHaveClass('border-brand-500');

    // Simulate clicking/mousedown
    fireEvent.mouseDown(cell!);

    // Verify cell border color changes to match selected styling
    expect(cell).toHaveClass('border-brand-500');
  });
});
