// HMAC 서명 — D21 Kakao synthetic email 검증용
// HMAC_SECRET은 Supabase secret. 클라이언트 expose 금지.

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

export function syntheticEmail(kakaoId: string): string {
  return `kakao_${kakaoId}@denda.synthetic`;
}
