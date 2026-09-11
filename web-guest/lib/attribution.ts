// D28 자체 deferred deep link — web-guest 측 click_log 호출.
//
// 게스트가 단축 URL `/g/[token]` 진입 → nickname 입력 완료 시점에 호출.
// Supabase Edge Function `attribution_click_log`가 server 측에서 IP+UA hash 후
// branch_attributions UPSERT. 실패해도 silent (UX 보호 — 투표 진행은 정상).

export interface LogAttributionClickArgs {
  branchLinkId: string;
  groupId: string;
  guestToken: string;
}

export type LogAttributionClickResult = { ok: true } | { ok: false; error: string };

export async function logAttributionClick(
  args: LogAttributionClickArgs,
): Promise<LogAttributionClickResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, error: 'NEXT_PUBLIC_SUPABASE_URL/ANON_KEY missing' };
  }

  const url = `${supabaseUrl}/functions/v1/attribution_click_log`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        branch_link_id: args.branchLinkId,
        group_id: args.groupId,
        guest_token: args.guestToken,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `attribution_click_log HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
