// kakao_local_search — S16 Phase b KakaoLocalProvider Edge Function.
//
// Q-A2 "허용" 답변 수신(2026-06-01, D37) → 카카오 Local 키워드검색 proxy.
// KAKAO_REST_API_KEY는 Edge env only (CLAUDE.md rule 7 — key-secrecy proxy 강제, Q-B8 참조).
//
// 클라이언트 `src/lib/places/KakaoLocalProvider.ts`가 supabase.functions.invoke로 호출.
//
// Request: POST {
//   query: string    — 검색어 (필수, 비어있지 않음)
//   display?: number — 결과 수 (옵션, 기본 15, 1~15 clamp는 fetchKakaoLocal에서)
// }
// Response: { ok: true, results: PlaceSearchResult[] }
//
// 환경변수:
//   SUPABASE_URL / SUPABASE_ANON_KEY — auth.getUser (인증 사용자만 → quota 보호)
//   KAKAO_REST_API_KEY — 카카오 Local 인증 (Edge env only)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { getAnonClient } from '../_lib/supabase.ts';
import { errorResponse, handlePreflight, jsonResponse } from '../_lib/http.ts';
import {
  buildPlaceSearchResults,
  fetchKakaoLocal,
  KakaoLocalError,
} from '../_lib/kakao_local.ts';

// ---------------------------------------------------------------------------
// 순수 함수: 입력 파싱 / 에러 → HTTP 매핑
// ---------------------------------------------------------------------------

const DEFAULT_DISPLAY = 15; // 카카오 키워드검색 size max = 15

export interface SearchRequest {
  query: string;
  display: number;
}

export function parseSearchRequest(body: unknown): SearchRequest {
  if (body === null || typeof body !== 'object') {
    throw new Error('요청 본문이 필요합니다.');
  }
  const o = body as Record<string, unknown>;
  if (typeof o.query !== 'string') {
    throw new Error('query(검색어)가 필요합니다.');
  }
  const query = o.query.trim();
  if (query.length === 0) {
    throw new Error('검색어를 입력해주세요.');
  }

  let display = DEFAULT_DISPLAY;
  if (o.display !== undefined && o.display !== null) {
    if (typeof o.display !== 'number' || !Number.isFinite(o.display)) {
      throw new Error('display는 숫자여야 합니다.');
    }
    display = o.display;
  }

  return { query, display };
}

export interface HttpErrorMapping {
  status: number;
  message: string;
}

export function kakaoErrorToHttp(err: unknown): HttpErrorMapping {
  if (err instanceof KakaoLocalError) {
    switch (err.kind) {
      case 'rate_limit':
        return { status: 429, message: '잠시 후 다시 시도해주세요.' };
      case 'unauthorized':
      case 'network':
      case 'bad_response':
        // 서버 설정/외부 API 문제 — 원인 노출하지 않고 동일 안내
        return { status: 502, message: '장소를 불러오지 못했어요. 잠시 후 다시 시도해주세요.' };
    }
  }
  return { status: 500, message: '장소를 불러오지 못했어요. 잠시 후 다시 시도해주세요.' };
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

async function handler(req: Request): Promise<Response> {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') {
    return errorResponse('POST 요청만 허용됩니다.', 405);
  }

  let parsed: SearchRequest;
  try {
    const rawBody = await req.json();
    parsed = parseSearchRequest(rawBody);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : String(err), 400);
  }

  // 인증 사용자만 — anon key가 public이므로 getUser로 검증 (quota 보호).
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return errorResponse('인증이 필요합니다.', 401);
  }
  const anon = getAnonClient(authHeader);
  const { data: userData, error: userError } = await anon.auth.getUser();
  if (userError || !userData?.user) {
    return errorResponse('인증이 만료되었어요. 다시 로그인해주세요.', 401);
  }

  const restApiKey = Deno.env.get('KAKAO_REST_API_KEY');
  if (!restApiKey) {
    return errorResponse('장소 검색이 아직 준비되지 않았어요.', 503);
  }

  try {
    const documents = await fetchKakaoLocal({
      query: parsed.query,
      display: parsed.display,
      restApiKey,
      fetch: globalThis.fetch,
    });
    const results = buildPlaceSearchResults(documents);
    return jsonResponse({ ok: true, results });
  } catch (err) {
    const mapped = kakaoErrorToHttp(err);
    return errorResponse(mapped.message, mapped.status);
  }
}

if (import.meta.main) {
  serve(handler);
}

export { handler };
