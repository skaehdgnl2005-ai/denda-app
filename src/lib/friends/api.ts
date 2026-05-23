import { DateTime } from 'luxon';

export interface FriendUser {
  id: string;
  nickname: string;
  avatar_url?: string;
  recent_meetings_count?: number;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender?: FriendUser;
  receiver?: FriendUser;
  created_at: string; // ISO string
}

// Default mock data for stub implementation
let mockFriends: FriendUser[] = [
  { id: 'user-2', nickname: '홍길동', recent_meetings_count: 5 },
  { id: 'user-3', nickname: '김영희', recent_meetings_count: 12 },
  { id: 'user-4', nickname: '이철수', recent_meetings_count: 0 },
];

let mockIncomingRequests: FriendRequest[] = [
  {
    id: 'req-1',
    sender_id: 'user-5',
    receiver_id: 'current-user',
    sender: { id: 'user-5', nickname: '박민수' },
    created_at: '2026-05-23T10:00:00Z',
  },
  {
    id: 'req-2',
    sender_id: 'user-6',
    receiver_id: 'current-user',
    sender: { id: 'user-6', nickname: '최수지' },
    created_at: '2026-05-23T11:30:00Z',
  },
];

let mockOutgoingRequests: FriendRequest[] = [
  {
    id: 'req-3',
    sender_id: 'current-user',
    receiver_id: 'user-7',
    receiver: { id: 'user-7', nickname: '정다은' },
    created_at: '2026-05-23T09:15:00Z',
  },
];

export const friendsApi = {
  // Get list of friends
  list: async (): Promise<FriendUser[]> => {
    return Promise.resolve([...mockFriends]);
  },

  // Search users to add as friends
  search: async (query: string): Promise<FriendUser[]> => {
    if (!query.trim()) return Promise.resolve([]);
    // Mock database search
    const candidates = [
      { id: 'user-10', nickname: '김하늘' },
      { id: 'user-11', nickname: '이태양' },
      { id: 'user-12', nickname: '박우주' },
    ];
    const filtered = candidates.filter((u) => u.nickname.includes(query));
    return Promise.resolve(filtered);
  },

  // Send a friend request
  sendRequest: async (userId: string): Promise<void> => {
    const newReq: FriendRequest = {
      id: `req-${Date.now()}`,
      sender_id: 'current-user',
      receiver_id: userId,
      receiver: { id: userId, nickname: `사용자_${userId.slice(0, 4)}` },
      created_at: DateTime.now().toUTC().toISO() ?? '',
    };
    mockOutgoingRequests.push(newReq);
    return Promise.resolve();
  },

  // List incoming friend requests
  listIncomingRequests: async (): Promise<FriendRequest[]> => {
    return Promise.resolve([...mockIncomingRequests]);
  },

  // List outgoing friend requests
  listOutgoingRequests: async (): Promise<FriendRequest[]> => {
    return Promise.resolve([...mockOutgoingRequests]);
  },

  // Accept incoming friend request
  acceptRequest: async (requestId: string): Promise<void> => {
    const request = mockIncomingRequests.find((r) => r.id === requestId);
    if (request && request.sender) {
      // Add to friends list
      mockFriends.push({
        id: request.sender.id,
        nickname: request.sender.nickname,
        recent_meetings_count: 0,
      });
      // Remove from incoming requests
      mockIncomingRequests = mockIncomingRequests.filter((r) => r.id !== requestId);
    }
    return Promise.resolve();
  },

  // Reject incoming friend request
  rejectRequest: async (requestId: string): Promise<void> => {
    mockIncomingRequests = mockIncomingRequests.filter((r) => r.id !== requestId);
    return Promise.resolve();
  },

  // Cancel outgoing friend request
  cancelRequest: async (requestId: string): Promise<void> => {
    mockOutgoingRequests = mockOutgoingRequests.filter((r) => r.id !== requestId);
    return Promise.resolve();
  },

  // Remove a friend relationship
  removeFriend: async (friendId: string): Promise<void> => {
    mockFriends = mockFriends.filter((f) => f.id !== friendId);
    return Promise.resolve();
  },

  // Block a user
  blockUser: async (userId: string): Promise<void> => {
    // Remove from friends list if they are friends
    mockFriends = mockFriends.filter((f) => f.id !== userId);
    // Remove requests
    mockIncomingRequests = mockIncomingRequests.filter((r) => r.sender_id !== userId);
    mockOutgoingRequests = mockOutgoingRequests.filter((r) => r.receiver_id !== userId);
    return Promise.resolve();
  },

  // Report a user
  reportUser: async (userId: string, reason: string, description: string): Promise<void> => {
    console.log(`Report submitted for user ${userId}. Reason: ${reason}, Description: ${description}`);
    return Promise.resolve();
  },

  // Test helpers to reset mock states in tests
  __resetMocks: () => {
    mockFriends = [
      { id: 'user-2', nickname: '홍길동', recent_meetings_count: 5 },
      { id: 'user-3', nickname: '김영희', recent_meetings_count: 12 },
      { id: 'user-4', nickname: '이철수', recent_meetings_count: 0 },
    ];
    mockIncomingRequests = [
      {
        id: 'req-1',
        sender_id: 'user-5',
        receiver_id: 'current-user',
        sender: { id: 'user-5', nickname: '박민수' },
        created_at: '2026-05-23T10:00:00Z',
      },
      {
        id: 'req-2',
        sender_id: 'user-6',
        receiver_id: 'current-user',
        sender: { id: 'user-6', nickname: '최수지' },
        created_at: '2026-05-23T11:30:00Z',
      },
    ];
    mockOutgoingRequests = [
      {
        id: 'req-3',
        sender_id: 'current-user',
        receiver_id: 'user-7',
        receiver: { id: 'user-7', nickname: '정다은' },
        created_at: '2026-05-23T09:15:00Z',
      },
    ];
  },
};
