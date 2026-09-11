// KakaoLocalProvider — S16 Phase b 장소 검색 provider (Q-A2 "허용" 답변 수신 → D37).
//
// 카카오 Local 키워드검색은 REST API key 필요 → 클라이언트 직접 호출 금지 (CLAUDE.md rule 7,
// key-secrecy proxy 강제 — Q-B8 참조). Edge Function `kakao_local_search`를
// supabase.functions.invoke로 호출 (REST key는 Edge env).
//
// NaverSearchProvider(D36)와 같은 PlaceSearchProvider 인터페이스 → caller(지도 화면) 코드 변경 없이
// provider 주입만 교체 가능. 데이터 quality 비교 후 우위 시 primary 교체 (live 비교는 키 등록 후).
//
// 사용:
//   const provider: PlaceSearchProvider = new KakaoLocalProvider();
//   const results = await provider.search({ query: '강남 카페', display: 15 });

import { supabase } from '@/lib/supabase/client';

import type {
  PlaceSearchProvider,
  PlaceSearchQuery,
  PlaceSearchResult,
} from './PlaceSearchProvider';

interface KakaoSearchEdgeResponse {
  ok: true;
  results?: PlaceSearchResult[];
}

interface KakaoSearchBody {
  query: string;
  display?: number;
}

const SEARCH_FAILED_MESSAGE = '장소를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';

export class KakaoLocalProvider implements PlaceSearchProvider {
  readonly source = 'kakao' as const;

  async search(query: PlaceSearchQuery): Promise<PlaceSearchResult[]> {
    const q = query.query.trim();
    if (q.length === 0) {
      throw new Error('검색어를 입력해주세요.');
    }

    const body: KakaoSearchBody = { query: q };
    if (query.display !== undefined) {
      body.display = query.display;
    }

    const { data, error } = await supabase.functions.invoke<KakaoSearchEdgeResponse>(
      'kakao_local_search',
      { body },
    );

    if (error || !data) {
      throw new Error(SEARCH_FAILED_MESSAGE);
    }

    return data.results ?? [];
  }
}
