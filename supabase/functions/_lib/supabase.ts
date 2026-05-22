// service_role Supabase client (Edge Function 전용)
// 절대 클라이언트로 export 금지. CLAUDE.md 규칙 7 위반.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function getServiceRoleClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env missing');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getAnonClient(authHeader: string | null): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY env missing');
  }
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader ?? '' } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
