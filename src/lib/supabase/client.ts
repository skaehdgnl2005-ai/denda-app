// Supabase 클라이언트 (anon key — D25 always load)
// service_role key는 Edge Function only. 여기서 import 금지.

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import { createSecureStorageAdapter } from './secureStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY 환경 변수가 설정되지 않았습니다. .env.local 확인.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // RN에는 localStorage가 없어 어댑터 미주입 시 메모리 폴백 → 앱 재시작마다 로그아웃.
    // SecureStore 2048바이트 제한은 청크 어댑터가 흡수 (secureStorage.ts).
    storage: createSecureStorageAdapter(SecureStore),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
