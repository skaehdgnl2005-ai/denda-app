// HMAC SHA-256 utility — D28 자체 deferred deep link fingerprint salt 용도.
// HMAC_SECRET은 Supabase secret. 클라이언트 expose 금지.
//
// 이력: D21 (Kakao synthetic email 검증) 용도였으나 D29 (Kakao OIDC) 채택으로
//       D21 폐기. syntheticEmail() 함수는 제거됨. hmacSha256/verifyHmacSha256은
//       D28 attribution_match Edge Function의 ip_hash·ua_hash 생성에 재사용.

export async function hmacSha256(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyHmacSha256(
  message: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expected = await hmacSha256(message, secret);
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}
