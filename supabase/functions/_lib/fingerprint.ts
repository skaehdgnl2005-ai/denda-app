// D28 자체 deferred deep link fingerprint helper.
// 게스트 단축 URL 클릭 시 server 측에서 IP + UA hash 기록 → 앱 첫 실행 시 매칭.
// HMAC_SECRET 재사용 (hmac.ts 주석 — D21 폐기 후 D28 용도로 재사용).
//
// 보안: hash 결과만 DB 저장 (raw IP / UA는 저장 X). 한국 PIPA "개인정보 최소 수집".

import { hmacSha256 } from './hmac.ts';

/**
 * X-Forwarded-For 또는 X-Real-IP 헤더에서 원본 client IP 추출.
 * Vercel·Supabase Edge proxy 통과 시 가장 왼쪽 IP가 원본.
 * 둘 다 없으면 빈 문자열 (fingerprint 매칭 실패 → invite_code fallback).
 */
export function extractClientIp(req: Request): string {
  const xff = req.headers.get('X-Forwarded-For');
  if (xff) {
    const first = xff.split(',')[0]?.trim() ?? '';
    if (first.length > 0) return first;
  }
  const realIp = req.headers.get('X-Real-IP');
  if (realIp) return realIp.trim();
  return '';
}

/**
 * User-Agent header (없으면 빈 문자열).
 * RN 첫 실행 시 native UA와 web UA가 다른 점은 D28 risk #1 (정확도 50% 이하).
 */
export function extractUserAgent(req: Request): string {
  return req.headers.get('User-Agent') ?? '';
}

export interface FingerprintHashes {
  ipHash: string;
  uaHash: string;
}

export interface FingerprintArgs {
  ip: string;
  ua: string;
  salt: string;
}

/**
 * IP + UA를 HMAC-SHA256으로 hash. 같은 (ip, ua, salt) → 같은 hash.
 * salt = Supabase secret `HMAC_SECRET` (Edge env).
 * Result hex 64자리.
 */
export async function computeFingerprintHashes(
  args: FingerprintArgs,
): Promise<FingerprintHashes> {
  const [ipHash, uaHash] = await Promise.all([
    hmacSha256(args.ip, args.salt),
    hmacSha256(args.ua, args.salt),
  ]);
  return { ipHash, uaHash };
}
