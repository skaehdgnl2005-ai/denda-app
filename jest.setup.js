// Jest global setup — Expo + RN mocks.
// jest-expo preset already handles most native module mocks; this file is for
// project-specific globals (e.g., env vars defaulted to test values).

process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'test-anon-key';
process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY =
  process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY ?? 'test-kakao-native-key';
